import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { MeetingList } from "./MeetingList";

export default async function MeetingsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <PageHeader title="会议记录" subtitle="飞书妙记列表，可查看逐字稿和生成纪要" />
      <MeetingList />
    </div>
  );
}
