import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import type { Claim } from "../../types";
import { ClaimStatus } from "../../types";
import { shortenAddress, ipfsUrl } from "../../utils/formatters";
import { ExternalLink } from "lucide-react";

interface ClaimCardProps {
  claim: Claim;
  claimId: number;
  isClaimant: boolean;
  onDistribute?: (claimId: number) => void;
  distributing?: boolean;
}

export function ClaimCard({ claim, claimId, isClaimant, onDistribute, distributing }: ClaimCardProps) {
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
      {isClaimant && claim.status === ClaimStatus.Approved && onDistribute && (
        <Button onClick={() => onDistribute(claimId)} loading={distributing} size="sm">
          Claim Funds
        </Button>
      )}
    </Card>
  );
}
