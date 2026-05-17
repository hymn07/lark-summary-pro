import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import { MinutesList } from "./MinutesList";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <h2 className="font-bold text-2xl mb-1">会议纪要</h2>
      <p className="text-sm text-gray-500 mb-6">最近生成的会议纪要，开完会自动出现在这里</p>
      <MinutesList />
    </div>
  );
}
