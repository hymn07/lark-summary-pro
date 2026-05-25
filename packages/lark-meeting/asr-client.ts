import { uploadObject, getSignedUrl } from "@repo/storage";

interface AsrProvider {
	apiBase: string;
	apiKey: string;
	model: string;
}

// 主入口：根据 provider 自动路由到对应 adapter
export async function transcribeFile(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	const adapter = getAdapterType(provider.apiBase);

	switch (adapter) {
		case "openai":
			return transcribeOpenAI(provider, audioBuffer, fileName);
		case "dashscope":
			return transcribeDashScope(provider, audioBuffer, fileName);
		case "volcengine":
			return transcribeVolcengine(provider, audioBuffer, fileName);
		default:
			throw new Error(`不支持的 ASR 提供商: ${provider.apiBase}`);
	}
}

function getAdapterType(apiBase: string): "openai" | "dashscope" | "volcengine" {
	if (apiBase.includes("dashscope.aliyuncs.com")) return "dashscope";
	if (apiBase.includes("openspeech.bytedance.com")) return "volcengine";
	return "openai";
}

// ─── OpenAI Whisper 标准格式 ───
async function transcribeOpenAI(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	const formData = new FormData();
	const ext = fileName.split(".").pop() ?? "wav";
	const mimeType = extToMime(ext);
	formData.append("file", new Blob([audioBuffer], { type: mimeType }), fileName);
	formData.append("model", provider.model || "whisper-1");
	formData.append("response_format", "text");

	const baseUrl = provider.apiBase.replace(/\/+$/, "");
	const res = await fetch(`${baseUrl}/audio/transcriptions`, {
		method: "POST",
		headers: { Authorization: `Bearer ${provider.apiKey}` },
		body: formData,
	});

	if (!res.ok) {
		console.error("[ASR OpenAI] 请求失败:", res.status, await res.text().catch(() => ""));
		return null;
	}

	if (provider.model === "whisper-1" || provider.model.includes("whisper")) {
		return (await res.json()).text ?? null;
	}
	return await res.text();
}

// ─── 阿里云 DashScope ───
async function transcribeDashScope(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	// 千问3-ASR-Flash: 用 base64 data URI 直传（支持本地文件，≤5min/10MB）
	// Fun-ASR / Filetrans: 用 MinIO URL
	const isLongModel = provider.model.includes("fun-asr") || provider.model.includes("filetrans");

	if (isLongModel) {
		return transcribeDashScopeLong(provider, audioBuffer, fileName);
	}
	return transcribeDashScopeFlash(provider, audioBuffer, fileName);
}

// 短音频：base64 data URI 直传
async function transcribeDashScopeFlash(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	const ext = fileName.split(".").pop() ?? "mp3";
	const mimeType = extToMime(ext);
	const base64 = audioBuffer.toString("base64");
	const dataUri = `data:${mimeType};base64,${base64}`;

	const baseUrl = provider.apiBase.replace(/\/+$/, "");
	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${provider.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: provider.model || "qwen3-asr-flash",
			messages: [
				{
					role: "user",
					content: [{ type: "input_audio", input_audio: { data: dataUri } }],
				},
			],
			asr_options: { enable_itn: false },
		}),
	});

	if (!res.ok) {
		console.error("[ASR DashScope Flash] 请求失败:", res.status, await res.text().catch(() => ""));
		return null;
	}

	const json = await res.json();
	return json.choices?.[0]?.message?.content ?? null;
}

// 长音频：MinIO 临时上传 → URL → 异步任务
async function transcribeDashScopeLong(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	const url = await uploadToMinio(audioBuffer, fileName);

	const baseUrl = provider.apiBase.replace(/\/+$/, "");

	// 1. 提交任务
	const submitRes = await fetch(`${baseUrl}/services/audio/asr/transcription`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${provider.apiKey}`,
			"Content-Type": "application/json",
			"X-DashScope-Async": "enable",
		},
		body: JSON.stringify({
			model: provider.model || "fun-asr",
			input: { file_url: url },
			parameters: { enable_itn: false },
		}),
	});

	if (!submitRes.ok) {
		console.error("[ASR DashScope Long] 提交失败:", submitRes.status, await submitRes.text().catch(() => ""));
		return null;
	}

	const submitJson = await submitRes.json();
	const taskId = submitJson.output?.task_id;
	if (!taskId) {
		console.error("[ASR DashScope Long] 未获取到 task_id:", submitJson);
		return null;
	}

	// 2. 轮询结果（最多等 10 分钟）
	const text = await pollDashScopeTask(baseUrl, provider.apiKey, taskId);
	if (!text) return null;

	// 3. 清理 MinIO 临时文件
	await deleteFromMinio(fileName).catch(() => {});
	return text;
}

async function pollDashScopeTask(
	baseUrl: string,
	apiKey: string,
	taskId: string,
): Promise<string | null> {
	const maxAttempts = 200; // 10 min @ 3s
	for (let i = 0; i < maxAttempts; i++) {
		await sleep(3000);

		const res = await fetch(`${baseUrl}/tasks/${taskId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"X-DashScope-Async": "enable",
			},
		});

		if (!res.ok) continue;

		const json = await res.json();
		const status = json.output?.task_status;

		if (status === "SUCCEEDED") {
			const transcriptionUrl = json.output?.results?.[0]?.transcription_url
				?? json.output?.result?.transcription_url;

			if (!transcriptionUrl) return null;

			// 下载完整 JSON 结果
			const dlRes = await fetch(transcriptionUrl);
			if (!dlRes.ok) return null;

			const dlJson = await dlRes.json();
			const transcripts = dlJson.transcripts ?? [];
			return transcripts.map((t: { text?: string }) => t.text ?? "").join("\n\n");
		}

		if (status === "FAILED" || status === "UNKNOWN") {
			console.error("[ASR DashScope] 任务失败:", json.output?.message);
			return null;
		}
	}

	console.error("[ASR DashScope] 轮询超时");
	return null;
}

// ─── 火山引擎 ───
async function transcribeVolcengine(
	provider: AsrProvider,
	audioBuffer: Buffer,
	fileName: string,
): Promise<string | null> {
	const url = await uploadToMinio(audioBuffer, fileName);

	const ext = fileName.split(".").pop()?.toLowerCase() ?? "wav";
	const format = ext === "mp3" ? "mp3" : ext === "ogg" ? "ogg" : "wav";
	const requestId = crypto.randomUUID();
	const baseUrl = provider.apiBase.replace(/\/+$/, "");

	// 1. 提交任务
	const submitHeaders: Record<string, string> = {
		"X-Api-Key": provider.apiKey,
		"X-Api-Resource-Id": provider.model || "volc.seedasr.auc",
		"X-Api-Request-Id": requestId,
		"X-Api-Sequence": "-1",
		"Content-Type": "application/json",
	};

	const submitRes = await fetch(`${baseUrl}/api/v3/auc/bigmodel/submit`, {
		method: "POST",
		headers: submitHeaders,
		body: JSON.stringify({
			user: { uid: "lark-summary-pro" },
			audio: { format, url },
			request: { model_name: "bigmodel" },
		}),
	});

	if (!submitRes.ok) {
		console.error("[ASR Volcengine] 提交失败:", submitRes.status, await submitRes.text().catch(() => ""));
		return null;
	}

	// 2. 轮询结果
	const queryHeaders: Record<string, string> = {
		"X-Api-Key": provider.apiKey,
		"X-Api-Resource-Id": provider.model || "volc.seedasr.auc",
		"X-Api-Request-Id": requestId,
		"Content-Type": "application/json",
	};

	const maxAttempts = 200;
	for (let i = 0; i < maxAttempts; i++) {
		await sleep(3000);

		const queryRes = await fetch(`${baseUrl}/api/v3/auc/bigmodel/query`, {
			method: "POST",
			headers: queryHeaders,
			body: "{}",
		});

		if (!queryRes.ok) continue;

		const json = await queryRes.json();
		const statusCode = queryRes.headers.get("X-Api-Status-Code");
		const statusMsg = queryRes.headers.get("X-Api-Message");

		if (statusCode === "20000000" && json.result?.text) {
			await deleteFromMinio(fileName).catch(() => {});
			return json.result.text as string;
		}

		if (statusCode && !["20000000", "20000001", "20000002"].includes(statusCode)) {
			console.error(`[ASR Volcengine] 任务失败: ${statusCode} ${statusMsg}`);
			return null;
		}
	}

	console.error("[ASR Volcengine] 轮询超时");
	return null;
}

// ─── MinIO 工具 ───
async function uploadToMinio(buffer: Buffer, fileName: string): Promise<string> {
	const ts = Date.now();
	const key = `asr-temp/${ts}-${fileName}`;
	await uploadObject(key, buffer, { bucket: "attachments" });
	const url = await getSignedUrl(key, { bucket: "attachments", expiresIn: 7200 });
	return url;
}

async function deleteFromMinio(fileName: string): Promise<void> {
	// MinIO attachments bucket 里的临时文件定期清理即可
	// 暂不实现删除，避免引入额外依赖
}

// ─── 工具函数 ───
function extToMime(ext: string): string {
	const map: Record<string, string> = {
		wav: "audio/wav", wave: "audio/wav",
		mp3: "audio/mpeg", mpeg: "audio/mpeg",
		mp4: "audio/mp4", m4a: "audio/mp4",
		flac: "audio/flac",
		ogg: "audio/ogg", oga: "audio/ogg",
		webm: "audio/webm",
		aac: "audio/aac",
	};
	return map[ext.toLowerCase()] ?? "audio/wav";
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
