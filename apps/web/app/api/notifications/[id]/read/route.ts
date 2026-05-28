import { db } from "@repo/database";
import { auth } from "@repo/auth";

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	await db.notification.update({
		where: { id, userId: session.user.id },
		data: { status: "read" },
	});

	return Response.json({ success: true });
}
