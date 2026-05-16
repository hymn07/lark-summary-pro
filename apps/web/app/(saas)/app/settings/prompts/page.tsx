import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { PromptManager } from "./PromptManager";

export default async function PromptsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <PageHeader
        title="Prompt 版本管理"
        subtitle="上传 1-3 篇示例纪要，AI 学习你的风格"
      />
      <PromptManager />
    </div>
  );
}
