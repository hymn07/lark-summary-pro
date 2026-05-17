import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@repo/database";
import { AdminPromptManager } from "./AdminPromptManager";

export default async function AdminPromptPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin" && !(session.user as Record<string, unknown>).isAdmin) {
    redirect("/app");
  }

  const defaultPrompt = await db.promptVersion.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />返回管理后台
      </Link>
      <PageHeader title="默认 Prompt" subtitle="设置公司默认的会议纪要风格" />
      <AdminPromptManager initialPrompt={defaultPrompt as { id: string; name: string; styleDescription: string | null } | null} />
    </div>
  );
}
