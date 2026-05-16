import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin" && !(session.user as Record<string, unknown>).isAdmin) {
    redirect("/app");
  }

  const [totalRecords, totalUsers, modelProviders] = await Promise.all([
    db.meetingRecord.count(),
    db.user.count(),
    db.modelProvider.count(),
  ]);

  const completedRecords = await db.meetingRecord.count({
    where: { status: "completed" },
  });

  return (
    <div>
      <PageHeader title="管理后台" subtitle="成员管理、模型配置、默认 Prompt" />
      <AdminDashboard
        totalRecords={totalRecords}
        totalUsers={totalUsers}
        completedRecords={completedRecords}
        modelProviders={modelProviders}
      />
    </div>
  );
}
