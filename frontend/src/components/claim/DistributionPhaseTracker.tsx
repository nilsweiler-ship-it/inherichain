import { Button } from "../ui/Button";
import type { Claim } from "../../types";
import { ClaimStatus, DistributionPhase } from "../../types";
import { formatTimeRemaining } from "../../utils/formatters";
import { PHASE2_DELAY_DAYS, PHASE3_DELAY_DAYS } from "../../utils/constants";

interface DistributionPhaseTrackerProps {
  claim: Claim;
  claimId: number;
  onDistributePhase: (claimId: number, phase: DistributionPhase) => void;
  loading?: boolean;
}

export function DistributionPhaseTracker({ claim, claimId, onDistributePhase, loading }: DistributionPhaseTrackerProps) {
  if (claim.status !== ClaimStatus.Distributing && claim.status !== ClaimStatus.Distributed) {
    return null;
  }

  const approvedAt = Number(claim.approvedAt);
  const now = Math.floor(Date.now() / 1000);
  const phase2Unlock = approvedAt + PHASE2_DELAY_DAYS * 86400;
  const phase3Unlock = approvedAt + PHASE3_DELAY_DAYS * 86400;

  const phases = [
    {
      label: "Phase 1 (10%)",
      claimed: claim.phase1Claimed,
      unlocked: true,
      unlockTime: 0,
      phase: DistributionPhase.Phase1,
    },
    {
      label: "Phase 2 (40%)",
      claimed: claim.phase2Claimed,
      unlocked: now >= phase2Unlock,
      unlockTime: phase2Unlock,
      phase: DistributionPhase.Phase2,
    },
    {
      label: "Phase 3 (50%)",
      claimed: claim.phase3Claimed,
      unlocked: now >= phase3Unlock,
      unlockTime: phase3Unlock,
      phase: DistributionPhase.Phase3,
    },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-400">Distribution Phases</h4>
      <div className="flex gap-2">
        {phases.map((p, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full ${
              p.claimed ? "bg-gold" : p.unlocked ? "bg-gold/40" : "bg-gray-700"
            }`}
          />
        ))}
      </div>
      <div className="space-y-2">
        {phases.map((p, i) => {
          const canClaim = !p.claimed && p.unlocked && (i === 0 || phases[i - 1].claimed);
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <div>
                <span className={p.claimed ? "text-gold" : "text-gray-400"}>{p.label}</span>
                {p.claimed && <span className="ml-2 text-xs text-green-400">Claimed</span>}
                {!p.claimed && !p.unlocked && p.unlockTime > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    Unlocks in {formatTimeRemaining(p.unlockTime - now)}
                  </span>
                )}
              </div>
              {canClaim && (
                <Button size="sm" onClick={() => onDistributePhase(claimId, p.phase)} loading={loading}>
                  Claim
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
