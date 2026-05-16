import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { MeetingList } from "./MeetingList";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <PageHeader
        title="会议纪要"
        subtitle="最近生成的会议纪要，开完会自动出现在这里"
      />
      <MeetingList />
    </div>
  );
}
