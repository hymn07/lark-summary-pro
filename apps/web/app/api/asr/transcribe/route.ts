import { db } from "@repo/database";
import { transcribeFile } from "@repo/lark-meeting";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const providerId = formData.get("providerId") as string | null;
		const audioFile = formData.get("audioFile") as File | null;

		if (!providerId || !audioFile) {
			return NextResponse.json({ error: "缺少 providerId 或 audioFile" }, { status: 400 });
		}

		const provider = await db.modelProvider.findUnique({ where: { id: providerId } });
		if (!provider) {
			return NextResponse.json({ error: "ASR 提供商不存在" }, { status: 404 });
		}

		const buffer = Buffer.from(await audioFile.arrayBuffer());
		const text = await transcribeFile(
			{ apiBase: provider.apiBase, apiKey: provider.apiKey, model: (provider.models as string[])?.[0] ?? "" },
			buffer,
			audioFile.name,
		);

		if (text === null) {
			return NextResponse.json({ error: "转写失败" }, { status: 500 });
		}

		return NextResponse.json({ text });
	} catch (e) {
		console.error("[ASR API] 转写异常:", e);
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "未知错误" },
			{ status: 500 },
		);
	}
}
