import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import type { Challenge } from "../../types";
import { shortenAddress } from "../../utils/formatters";
import { formatEth } from "../../utils/formatters";

interface ChallengeCardProps {
  challenge: Challenge;
  challengeId: number;
  onResolve?: (challengeId: number) => void;
  onFinalize?: (challengeId: number) => void;
  loading?: boolean;
  canResolve?: boolean;
  canFinalize?: boolean;
}

export function ChallengeCard({
  challenge,
  challengeId,
  onResolve,
  onFinalize,
  loading,
  canResolve,
  canFinalize,
}: ChallengeCardProps) {
  return (
    <Card className="space-y-2 border-yellow-600/30">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Challenge #{challengeId}</span>
        <Badge variant={challenge.resolved ? (challenge.successful ? "success" : "danger") : "warning"}>
          {challenge.resolved ? (challenge.successful ? "Successful" : "Failed") : "Active"}
        </Badge>
      </div>
      <div className="text-sm space-y-1">
        <p className="text-gray-400">
          Challenger: <span className="font-mono text-white">{shortenAddress(challenge.challenger)}</span>
        </p>
        <p className="text-gray-400">
          Stake: <span className="text-white">{formatEth(challenge.stake)}</span>
        </p>
      </div>
      <div className="flex gap-2">
        {canResolve && !challenge.resolved && onResolve && (
          <Button size="sm" variant="secondary" onClick={() => onResolve(challengeId)} loading={loading}>
            Resolve (Re-vote)
          </Button>
        )}
        {canFinalize && challenge.resolved && onFinalize && (
          <Button size="sm" onClick={() => onFinalize(challengeId)} loading={loading}>
            Finalize
          </Button>
        )}
      </div>
    </Card>
  );
}
