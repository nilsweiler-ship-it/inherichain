import { Card } from "../ui/Card";
import { ClaimStatusBadge } from "../claim/ClaimStatusBadge";
import { ApproveRejectButtons } from "./ApproveRejectButtons";
import type { Claim } from "../../types";
import { ClaimStatus } from "../../types";
import { shortenAddress, ipfsUrl } from "../../utils/formatters";
import { ExternalLink } from "lucide-react";

interface VerificationCardProps {
  claim: Claim;
  claimId: number;
  planAddress: string;
  planName: string;
  requiredApprovals: number;
  totalVerifiers: number;
  onVote: (planAddress: string, claimId: number, approve: boolean) => void;
  loading?: boolean;
  hasVoted?: boolean;
}

export function VerificationCard({
  claim,
  claimId,
  planAddress,
  planName,
  requiredApprovals,
  totalVerifiers,
  onVote,
  loading,
  hasVoted,
}: VerificationCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gold">{planName}</h3>
          <span className="text-xs text-gray-500 font-mono">{shortenAddress(planAddress)}</span>
        </div>
        <ClaimStatusBadge status={claim.status} />
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-gray-400">
          Claim #{claimId} by <span className="font-mono text-white">{shortenAddress(claim.heir)}</span>
        </p>
        <p className="text-gray-400">
          Votes: {Number(claim.approvals)} / {requiredApprovals} approvals, {Number(claim.rejections)} rejections ({totalVerifiers} total verifiers)
          {Number(claim.voteRound) > 0 && ` — Round ${Number(claim.voteRound)}`}
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
      </div>
      {claim.status === ClaimStatus.Pending && !hasVoted && (
        <ApproveRejectButtons
          onApprove={() => onVote(planAddress, claimId, true)}
          onReject={() => onVote(planAddress, claimId, false)}
          loading={loading}
        />
      )}
      {hasVoted && <p className="text-sm text-gray-500">You have already voted</p>}
    </Card>
  );
}
