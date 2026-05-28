import { db } from "@repo/database";
import { MEMORY_CONFIG } from "./config";

interface UnknownFieldEntry {
	fieldName: string;
	description: string;
	userIntent: string;
	userId: string;
	messageId: string;
}

export async function discoverPatterns(): Promise<{
	insights: number;
	proposals: number;
}> {
	const classified = await db.conversationMessage.findMany({
		where: {
			processedAt: { not: null },
			unknownFields: { not: {} },
		},
		select: {
			id: true,
			unknownFields: true,
			intentConfidence: true,
			conversationId: true,
			conversation: { select: { userId: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 500,
	});

	if (classified.length === 0) return { insights: 0, proposals: 0 };

	// Collect all unknown field mentions
	const fieldMap = new Map<string, UnknownFieldEntry[]>();
	for (const msg of classified) {
		const fields = (msg.unknownFields as unknown as UnknownFieldEntry[]) ?? [];
		for (const f of fields) {
			if (!f.fieldName) continue;
			const key = f.fieldName.toLowerCase().trim();
			const existing = fieldMap.get(key) ?? [];
			existing.push({
				...f,
				userId: msg.conversation.userId,
				messageId: msg.id,
			});
			fieldMap.set(key, existing);
		}
	}

	let insights = 0;
	let proposals = 0;

	for (const [fieldName, entries] of fieldMap) {
		const uniqueUsers = new Set(entries.map((e) => e.userId));
		const userCounts = new Map<string, number>();
		for (const e of entries) {
			userCounts.set(e.userId, (userCounts.get(e.userId) ?? 0) + 1);
		}

		let scope: "personal" | "public" = "personal";

		if (uniqueUsers.size >= MEMORY_CONFIG.discovery.minUsersForProposal) {
			const qualifiedUsers = [...userCounts.entries()].filter(
				([, count]) => count >= 1
			);
			if (qualifiedUsers.length >= MEMORY_CONFIG.discovery.minUsersForProposal) {
				scope = "public";
			}
		}

		const confidence =
			entries.reduce((sum) => sum + 0.7, 0) / entries.length;

		if (entries.length >= MEMORY_CONFIG.discovery.minEvidenceForInsight) {
			await db.memoryInsight.create({
				data: {
					userId: entries[0].userId,
					type: "missing_dimension",
					scope,
					title: `用户关注"${fieldName}"`,
					description: `${uniqueUsers.size} 个用户共 ${entries.length} 次关注此维度。${scope === "public" ? "已升级为公共记忆。" : "暂为个人记忆。"}`,
					confidence,
					evidence: {
						sampleMessages: entries.slice(0, 3).map((e) => ({
							messageId: e.messageId,
							userIntent: e.userIntent,
						})),
						uniqueUsers: uniqueUsers.size,
						totalMentions: entries.length,
					},
					status: "proposed",
				},
			});
			insights++;
		}

		const bestDescription =
			entries.sort((a, b) => b.userIntent.length - a.userIntent.length)[0]
				?.description ?? fieldName;

		if (scope === "public") {
			const existing = await db.dimensionProposal.findFirst({
				where: { fieldName, scope: "public", userId: undefined as unknown as string },
			});
			if (existing) {
				await db.dimensionProposal.update({
					where: { id: existing.id },
					data: { evidenceCount: entries.length, uniqueUsers: uniqueUsers.size, confidence },
				});
			} else {
				await db.dimensionProposal.create({
					data: {
						fieldName,
						displayName: bestDescription,
						description: `从 ${uniqueUsers.size} 个用户的 ${entries.length} 次提问中发现`,
						suggestedType: "string",
						scope: "public",
						exampleValues: entries.slice(0, 3).map((e) => e.description),
						evidenceCount: entries.length,
						uniqueUsers: uniqueUsers.size,
						confidence,
					},
				});
			}
			proposals++;
		} else {
			for (const uid of uniqueUsers) {
				const userEntries = entries.filter((e) => e.userId === uid);
				if (userEntries.length < 2) continue;

				const existing = await db.dimensionProposal.findFirst({
					where: { fieldName, scope: "personal", userId: uid },
				});
				if (existing) {
					await db.dimensionProposal.update({
						where: { id: existing.id },
						data: { evidenceCount: userEntries.length, confidence },
					});
				} else {
					await db.dimensionProposal.create({
						data: {
							fieldName,
							displayName: bestDescription,
							description: `用户个人 ${userEntries.length} 次关注此维度`,
							suggestedType: "string",
							scope: "personal",
							userId: uid,
							exampleValues: userEntries.slice(0, 3).map((e) => e.description),
							evidenceCount: userEntries.length,
							uniqueUsers: 1,
							confidence,
						},
					});
				}
				proposals++;
			}
		}
	}

	return { insights, proposals };
}
