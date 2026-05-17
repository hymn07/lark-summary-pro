import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import { MeetingRecordsList } from "./MeetingRecordsList";

export default async function MeetingsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return <MeetingRecordsList />;
}
