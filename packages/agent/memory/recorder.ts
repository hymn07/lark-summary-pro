import { db } from "@repo/database";
import type { RecordMessageInput } from "./types";

export class ConversationRecorder {
	private activeConversations = new Map<string, string>();

	async ensureConversation(userId: string): Promise<string> {
		const existing = this.activeConversations.get(userId);
		if (existing) return existing;

		const conv = await db.conversation.create({
			data: { userId, status: "active" },
		});
		this.activeConversations.set(userId, conv.id);
		return conv.id;
	}

	async recordMessage(input: RecordMessageInput): Promise<string> {
		const msg = await db.conversationMessage.create({
			data: {
				conversationId: input.conversationId,
				role: input.role,
				content: input.content,
				referencedMeetings: input.referencedMeetings ?? [],
				toolsUsed: input.toolsUsed ?? [],
				tokenCount: input.tokenCount,
			},
		});

		await db.conversation.update({
			where: { id: input.conversationId },
			data: { messageCount: { increment: 1 } },
		});

		return msg.id;
	}

	async finalizeConversation(conversationId: string): Promise<void> {
		await db.conversation.update({
			where: { id: conversationId },
			data: { status: "completed" },
		});

		for (const [userId, convId] of this.activeConversations) {
			if (convId === conversationId) {
				this.activeConversations.delete(userId);
				break;
			}
		}
	}

	async endUserConversation(userId: string): Promise<void> {
		const convId = this.activeConversations.get(userId);
		if (convId) {
			await this.finalizeConversation(convId);
		}
	}
}

export const conversationRecorder = new ConversationRecorder();
