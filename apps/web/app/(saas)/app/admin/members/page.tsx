import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />返回管理后台
      </Link>
      <PageHeader title="成员管理" subtitle="管理可使用系统的成员" />
      <MemberList initialMembers={members} />
    </div>
  );
}
