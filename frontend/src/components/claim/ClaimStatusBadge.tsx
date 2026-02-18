import { Badge } from "../ui/Badge";
import { ClaimStatus, CLAIM_STATUS_LABELS } from "../../types";

const VARIANT_MAP: Record<ClaimStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  [ClaimStatus.None]: "default",
  [ClaimStatus.Pending]: "warning",
  [ClaimStatus.Approved]: "success",
  [ClaimStatus.Rejected]: "danger",
  [ClaimStatus.Distributed]: "info",
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge variant={VARIANT_MAP[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>;
}
