import { Badge } from "../ui/Badge";
import type { VerifierStats } from "../../types";

interface VerifierReputationBadgeProps {
  reputation: bigint | undefined;
  stats?: VerifierStats;
}

export function VerifierReputationBadge({ reputation, stats }: VerifierReputationBadgeProps) {
  const score = reputation !== undefined ? Number(reputation) : 0;

  let variant: "default" | "success" | "warning" | "danger" | "info" = "default";
  if (score >= 50) variant = "success";
  else if (score >= 20) variant = "info";
  else if (score > 0) variant = "warning";

  return (
    <div className="inline-flex items-center gap-2">
      <Badge variant={variant}>Rep: {score}</Badge>
      {stats && (
        <span className="text-xs text-gray-500" title={`Plans: ${Number(stats.plansVerified)}, Votes: ${Number(stats.votesCast)}, Challenges Lost: ${Number(stats.challengesLost)}, Slashed: ${Number(stats.bondsSlashed)}`}>
          {Number(stats.plansVerified)} plans, {Number(stats.votesCast)} votes
        </span>
      )}
    </div>
  );
}
