import { db } from "@repo/database";
import { auth } from "@repo/auth";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const body = await req.json();
	const { todoItemIds } = body as { todoItemIds: string[] };

	if (!todoItemIds?.length) {
		return Response.json({ error: "No items selected" }, { status: 400 });
	}

	// Mark selected todos as confirmed
	await db.todoItem.updateMany({
		where: { id: { in: todoItemIds }, userId: session.user.id },
		data: { status: "confirmed", confirmedAt: new Date() },
	});

	// Mark notification as actioned
	await db.notification.update({
		where: { id, userId: session.user.id },
		data: { status: "actioned" },
	});

	// Sync to Feishu todo document (fire-and-forget)
	void syncTodoDocument(session.user.id);

	return Response.json({ success: true });
}

async function syncTodoDocument(userId: string) {
	try {
		const { syncTodosToDocument } = await import("@repo/lark-meeting/todo-sync");
		await syncTodosToDocument(userId);
	} catch (e) {
		console.error("Todo doc sync failed:", e);
	}
}
