import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { ModelProviderList } from "./ModelProviderList";

export default async function ModelsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin" && !(session.user as Record<string, unknown>).isAdmin) {
    redirect("/app");
  }

  const providers = await db.modelProvider.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="模型提供商" subtitle="配置 LLM API，按成员分配可用模型" />
      <ModelProviderList initialProviders={providers} />
    </div>
  );
}
