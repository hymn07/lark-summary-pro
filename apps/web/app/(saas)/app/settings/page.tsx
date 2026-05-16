import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <PageHeader title="设置" subtitle="管理自动纪要、排除规则和特殊要求" />
      <SettingsForm />
    </div>
  );
}
