import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import { MeetingDetail } from "./MeetingDetail";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const { id } = await params;
  return <MeetingDetail id={id} />;
}
