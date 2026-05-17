import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />返回管理后台
      </Link>
      <PageHeader title="模型提供商" subtitle="配置 LLM API，按成员分配可用模型" />
      <ModelProviderList initialProviders={providers} />
    </div>
  );
}
