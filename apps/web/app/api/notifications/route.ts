import { db } from "@repo/database";
import { auth } from "@repo/auth";

export async function GET(req: Request) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const limit = Number(searchParams.get("limit") ?? 20);

	const notifications = await db.notification.findMany({
		where: { userId: session.user.id },
		orderBy: { createdAt: "desc" },
		take: Math.min(limit, 50),
	});

	const enriched = await Promise.all(
		notifications.map(async (n) => {
			let metadata = n.metadata as Record<string, unknown> | null;
			if (n.type === "todo_review" && metadata?.todoItemIds) {
				const items = await db.todoItem.findMany({
					where: {
						id: { in: metadata.todoItemIds as string[] },
						status: "pending",
					},
					select: { id: true, task: true, owner: true, deadline: true, priority: true },
				});
				metadata = { ...metadata, todoItems: items };
			}
			return { ...n, metadata };
		})
	);

	return Response.json({ notifications: enriched });
}
