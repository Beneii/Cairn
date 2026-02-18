import React from "react";
import { Badge } from "../../ui/badge";

export type SkillLifecycleStatus = "pending" | "building" | "promoted" | "failed" | "rejected";

const STATUS_STYLES: Record<SkillLifecycleStatus, string> = {
  pending: "bg-gray-500/20 text-gray-500",
  building: "bg-blue-500/20 text-blue-500",
  promoted: "bg-green-500/20 text-green-500",
  failed: "bg-red-500/20 text-red-500",
  rejected: "bg-orange-500/20 text-orange-500",
};

export function SkillLifecyclePill({ status }: { status: SkillLifecycleStatus }) {
  return (
    <Badge className={`text-[10px] uppercase font-bold tracking-widest ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </Badge>
  );
}
