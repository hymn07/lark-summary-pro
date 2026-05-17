"use client";
import { Badge } from "@repo/ui/components/badge";
export function SubscriptionStatusBadge({ status }: { status?: string }) {
  return <Badge variant="outline">{status ?? "inactive"}</Badge>;
}
