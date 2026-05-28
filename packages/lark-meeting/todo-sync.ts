import { db } from "@repo/database";
import { getTenantAccessToken } from "./feishu-client";

async function getOrCreateTodoDoc(userId: string): Promise<{ docToken: string; docUrl: string }> {
	const existing = await db.userTodoList.findUnique({ where: { userId } });
	if (existing?.docToken) {
		return { docToken: existing.docToken, docUrl: existing.docUrl ?? "" };
	}

	const token = await getTenantAccessToken();

	// Create new document
	const createRes = await fetch("https://open.feishu.cn/open-apis/docx/v1/documents", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ title: "我的会议待办" }),
	});

	if (!createRes.ok) throw new Error(`Create doc failed: ${createRes.status}`);

	const createJson = (await createRes.json()) as {
		data: { document: { document_id: string; url: string } };
	};
	const docToken = createJson.data.document.document_id;
	const docUrl = createJson.data.document.url;

	await db.userTodoList.upsert({
		where: { userId },
		create: { userId, docToken, docUrl },
		update: { docToken, docUrl },
	});

	return { docToken, docUrl };
}

export async function syncTodosToDocument(userId: string): Promise<void> {
	const confirmed = await db.todoItem.findMany({
		where: { userId, status: "confirmed" },
		orderBy: [{ priority: "asc" }, { deadline: "asc" }],
	});

	if (confirmed.length === 0) return;

	const { docToken } = await getOrCreateTodoDoc(userId);
	const token = await getTenantAccessToken();

	// Read existing document blocks to find completed todos
	let existingBlockIds = new Set<string>();
	try {
		const readRes = await fetch(
			`https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/blocks?page_size=500`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		if (readRes.ok) {
			const readJson = (await readRes.json()) as {
				data: { items: Array<{ block_id: string; todo?: { done: boolean } }> };
			};
			for (const item of readJson.data.items) {
				if (item.todo?.done) {
					existingBlockIds.add(item.block_id);
				}
			}
		}

		// Update DB for completed blocks
		if (existingBlockIds.size > 0) {
			await db.todoItem.updateMany({
				where: { blockId: { in: [...existingBlockIds] }, status: "confirmed" },
				data: { status: "completed" },
			});
		}
	} catch { /* document read failed, skip sync */ }

	// Get only newly confirmed items (not already written)
	const pendingItems = confirmed.filter(
		(i) => !i.blockId || !existingBlockIds.has(i.blockId)
	);

	if (pendingItems.length === 0) return;

	// Build document content: priority groups → dates
	const priorityOrder = { high: 0, medium: 1, low: 2 };
	const priorityLabels = { high: "🔴 高优先级", medium: "🟡 中优先级", low: "🟢 低优先级" };

	const grouped = new Map<string, Map<string, typeof pendingItems>>();
	for (const item of pendingItems) {
		const p = item.priority as "high" | "medium" | "low";
		if (!grouped.has(p)) grouped.set(p, new Map());
		const dateGroup = grouped.get(p)!;
		const date = item.deadline ?? "无截止日期";
		if (!dateGroup.has(date)) dateGroup.set(date, []);
		dateGroup.get(date)!.push(item);
	}

	// Build blocks for document (append at end)
	const blocks: Array<Record<string, unknown>> = [];

	// Add document structure: title blocks for priority sections then todo items
	const sortedPriorities = [...grouped.keys()].sort(
		(a, b) => (priorityOrder[a as keyof typeof priorityOrder] ?? 9) - (priorityOrder[b as keyof typeof priorityOrder] ?? 9)
	);

	for (const priority of sortedPriorities) {
		const headerLabel = priorityLabels[priority as keyof typeof priorityLabels] ?? priority;
		const dateGroups = grouped.get(priority)!;

		// Section header
		blocks.push({
			block_type: 3, // heading level 2
			heading2: {
				elements: [{ text_run: { content: headerLabel } }],
				style: {},
			},
		});

		for (const [date, items] of [...dateGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
			blocks.push({
				block_type: 9, // bullet list
				bullet: {
					elements: [{ text_run: { content: `📅 ${date}`, text_element_style: { bold: true } } }],
					style: {},
				},
			});

			for (const item of items) {
				const label = `${item.task}  ${item.owner ? `@${item.owner}` : ""}  ${item.deadline ? `截止 ${new Date(item.deadline).toLocaleDateString("zh-CN")}` : ""}`;
				blocks.push({
					block_type: 17, // todo
					todo: {
						elements: [{ text_run: { content: label } }],
						style: { done: false },
					},
				});
			}
		}
	}

	// Append blocks to document
	const appendRes = await fetch(
		`https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/blocks/batch_create`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				blocks: blocks.map((b) => ({ ...b, parent_id: docToken })),
				index: -1,
			}),
		}
	);

	if (appendRes.ok) {
		const appendJson = (await appendRes.json()) as {
			data: { blocks: Array<{ block_id: string }> };
		};
		// Store block_ids for future sync
		const todoBlocks = appendJson.data.blocks.filter((_, i) => {
			const block = blocks[i];
			return block?.block_type === 17;
		});
		for (let i = 0; i < todoBlocks.length && i < pendingItems.length; i++) {
			await db.todoItem.update({
				where: { id: pendingItems[i].id },
				data: { blockId: todoBlocks[i].block_id },
			});
		}
	}
}

export async function createTodoNotification(
	userId: string,
	meetingRecordId: string,
	todoItems: Array<{ task: string; owner?: string; deadline?: string; priority: string }>,
	meetingTopic: string,
): Promise<string> {
	// Create notification first
	const notification = await db.notification.create({
		data: {
			userId,
			type: "todo_review",
			title: `待办确认 · ${meetingTopic}`,
			status: "unread",
			metadata: { meetingRecordId, meetingTopic },
		},
	});

	// Create TodoItem records linked to notification
	const created = [];
	for (const item of todoItems) {
		const todo = await db.todoItem.create({
			data: {
				userId,
				meetingRecordId,
				notificationId: notification.id,
				task: item.task,
				owner: item.owner,
				deadline: item.deadline,
				priority: item.priority,
				status: "pending",
			},
		});
		created.push(todo);
	}

	// Update notification metadata with todo IDs
	await db.notification.update({
		where: { id: notification.id },
		data: { metadata: { meetingRecordId, meetingTopic, todoItemIds: created.map((t) => t.id) } },
	});

	return notification.id;
}

