import { z } from "zod";

export const MessageClassificationSchema = z.object({
	intentCategory: z.enum([
		"meeting_search",
		"meeting_detail",
		"minutes_generation",
		"minutes_clarification",
		"schema_field_query",
		"schema_field_extend",
		"retry_or_fix",
		"settings_query",
		"settings_update",
		"stats_query",
		"general_chat",
		"other",
	]),
	referencedFields: z.array(z.string()).describe(
		"Which of the 10 MeetingMinutes dimensions this question references"
	),
	unknownFields: z.array(z.object({
		fieldName: z.string(),
		description: z.string(),
		userIntent: z.string(),
	})).describe("Fields user asks about that are NOT in the current schema"),
	confidence: z.number().min(0).max(1),
});

export type MessageClassification = z.infer<typeof MessageClassificationSchema>;

export interface RecordMessageInput {
	conversationId: string;
	role: "user" | "assistant";
	content: string;
	referencedMeetings?: string[];
	toolsUsed?: string[];
	tokenCount?: number;
}

export interface RecordMessageOutput {
	messageId: string;
	conversationId: string;
}
