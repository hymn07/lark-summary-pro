import {
	buildAgentConfig,
	createActionTools,
	createMeetingSourceTools,
	createPromptTools,
	createSearchTools,
	createSettingsTools,
	createSystemTools,
	type PageContext,
	ToolRegistry,
} from "@repo/agent";
import {
	convertToModelMessages,
	stepCountIs,
	ToolLoopAgent,
	type ToolSet,
	type UIMessage,
} from "@repo/ai";
import { getFastModel } from "@repo/lark-meeting/model-factory";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@repo/api";
import { auth } from "@repo/auth";

export const maxDuration = 120;

function createAgentToolRegistry() {
	const registry = new ToolRegistry();
	registry.registerBuiltin(createSearchTools());
	registry.registerBuiltin(createMeetingSourceTools());
	registry.registerBuiltin(createActionTools());
	registry.registerBuiltin(createSettingsTools());
	registry.registerBuiltin(createPromptTools());
	registry.registerBuiltin(createSystemTools());
	return registry;
}

export async function POST(req: Request) {
	const ip = getClientIp(req);
	const rl = checkRateLimit(`agent-chat:${ip}`, RATE_LIMITS.agentChat);
	if (!rl.allowed) {
		return new Response(JSON.stringify({ error: "Too many requests" }), {
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
			},
		});
	}

	let body: {
		messages: UIMessage[];
		pageContext?: PageContext;
	};
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, pageContext } = body;

	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	const userId = session.user.id;
	const registry = createAgentToolRegistry();

	const ctx: PageContext = {
		...pageContext,
		userId,
	};

	const agentConfig = buildAgentConfig(
		ctx,
		registry.getTools({
			organizationId: ctx.organizationId ?? "",
			userId,
			entityId: ctx.entityId,
			meetingId: ctx.meetingId,
		}),
	);

	const model = await getFastModel();

	const agent = new ToolLoopAgent({
		model,
		instructions: agentConfig.systemPrompt,
		tools: agentConfig.tools as ToolSet,
		stopWhen: stepCountIs(agentConfig.maxSteps),
	});

	const modelMessages = await convertToModelMessages(messages, {
		ignoreIncompleteToolCalls: true,
	});

	const result = await agent.stream({
		messages: modelMessages,
	});

	return result.toUIMessageStreamResponse();
}
