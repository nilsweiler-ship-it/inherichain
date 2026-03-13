import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import { DistributionPhaseTracker } from "./DistributionPhaseTracker";
import type { Claim } from "../../types";
import { ClaimStatus, DistributionPhase } from "../../types";
import { shortenAddress, ipfsUrl, formatTimeRemaining } from "../../utils/formatters";
import { ExternalLink } from "lucide-react";

interface ClaimCardProps {
  claim: Claim;
  claimId: number;
  isClaimant: boolean;
  onDistributePhase?: (claimId: number, phase: DistributionPhase) => void;
  onFinalizeApproval?: (claimId: number) => void;
  onCancelClaim?: (claimId: number) => void;
  onRaiseChallenge?: (claimId: number) => void;
  loading?: boolean;
  isOwner?: boolean;
}

export function ClaimCard({
  claim,
  claimId,
  isClaimant,
  onDistributePhase,
  onFinalizeApproval,
  onCancelClaim,
  onRaiseChallenge,
  loading,
  isOwner,
}: ClaimCardProps) {
  const now = Math.floor(Date.now() / 1000);
  const challengeDeadline = Number(claim.challengeDeadline);
  const inChallengeWindow = claim.status === ClaimStatus.Approved && challengeDeadline > now;
  const challengeExpired = claim.status === ClaimStatus.Approved && challengeDeadline <= now;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Claim #{claimId}</span>
        <ClaimStatusBadge status={claim.status} />
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-gray-400">
          Heir: <span className="font-mono text-white">{shortenAddress(claim.heir)}</span>
        </p>
        <p className="text-gray-400">
          Votes: {Number(claim.approvals)} approved, {Number(claim.rejections)} rejected
          {Number(claim.voteRound) > 0 && ` (round ${Number(claim.voteRound)})`}
        </p>
        {claim.documentCID && (
          <a
            href={ipfsUrl(claim.documentCID)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold-light inline-flex items-center gap-1"
          >
            View Document <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {inChallengeWindow && (
          <p className="text-yellow-400 text-xs">
            Challenge window: {formatTimeRemaining(challengeDeadline - now)} remaining
          </p>
        )}
      </div>

      {/* Owner cancel during challenge window */}
      {isOwner && inChallengeWindow && onCancelClaim && (
        <Button variant="danger" size="sm" onClick={() => onCancelClaim(claimId)} loading={loading}>
          Cancel Claim
        </Button>
      )}

      {/* Anyone can raise challenge during window */}
      {inChallengeWindow && !isOwner && onRaiseChallenge && (
        <Button variant="secondary" size="sm" onClick={() => onRaiseChallenge(claimId)} loading={loading}>
          Raise Challenge
        </Button>
      )}

      {/* Finalize approval after challenge period */}
      {challengeExpired && onFinalizeApproval && (
        <Button size="sm" onClick={() => onFinalizeApproval(claimId)} loading={loading}>
          Finalize Approval
        </Button>
      )}

      {/* Progressive distribution phases */}
      {isClaimant && onDistributePhase && (
        <DistributionPhaseTracker
          claim={claim}
          claimId={claimId}
          onDistributePhase={onDistributePhase}
          loading={loading}
        />
      )}
    </Card>
  );
}
