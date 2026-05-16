import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { MemberList } from "./MemberList";

export default async function MembersPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin" && !(session.user as Record<string, unknown>).isAdmin) {
    redirect("/app");
  }

  const members = await db.user.findMany({
    select: { id: true, name: true, email: true, isAdmin: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="成员管理" subtitle="管理可使用系统的成员" />
      <MemberList initialMembers={members} />
    </div>
  );
}
