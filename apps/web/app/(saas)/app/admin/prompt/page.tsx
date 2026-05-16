import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
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
      <PageHeader
        title="默认 Prompt"
        subtitle="设置公司默认的会议纪要风格，所有成员的初始设置"
      />
      <AdminPromptManager initialPrompt={defaultPrompt} />
    </div>
  );
}
