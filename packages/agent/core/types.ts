import type { ToolSet } from "@repo/ai";

export interface PageContext {
	route?: string;
	organizationId?: string;
	userId?: string;
	entityId?: string;
	meetingId?: string;
	activeMeeting?: {
		id: string;
		topic: string | null;
		status: string;
		aiSummary?: string | null;
	} | null;
	activeFilters?: Record<string, string>;
}

export interface AgentConfig {
	systemPrompt: string;
	tools: ToolSet;
	maxSteps: number;
}

export interface ToolContext {
	organizationId: string;
	userId: string;
	entityId?: string;
	meetingId?: string;
}
