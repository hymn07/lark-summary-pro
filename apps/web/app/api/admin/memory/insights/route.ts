import { db } from "@repo/database";
import { auth } from "@repo/auth";

export async function GET(req: Request) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const data = await db.memoryInsight.findMany({
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	return Response.json({ data });
}
