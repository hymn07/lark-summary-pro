import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin" && !(session.user as Record<string, unknown>).isAdmin) {
    redirect("/app");
  }

  return (
    <div>
      <PageHeader title="管理后台" subtitle="成员管理、模型配置、默认 Prompt" />
      <AdminDashboard />
    </div>
  );
}
