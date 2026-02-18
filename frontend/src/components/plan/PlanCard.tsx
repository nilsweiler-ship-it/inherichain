import { Link } from "react-router";
import { Clock, Users, Wallet } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { PlanDetails } from "../../types";
import { formatEth, formatTimeRemaining, shortenAddress } from "../../utils/formatters";

interface PlanCardProps {
  plan: PlanDetails;
}

export function PlanCard({ plan }: PlanCardProps) {
  return (
    <Link to={`/plan/${plan.address}`} className="no-underline">
      <Card hover className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gold">{plan.planName}</h3>
          <Badge variant={plan.isInactive ? "danger" : "success"}>
            {plan.isInactive ? "Inactive" : "Active"}
          </Badge>
        </div>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>{formatEth(plan.balance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{Number(plan.heirCount)} heir(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>
              {plan.isInactive
                ? "Owner inactive"
                : `${formatTimeRemaining(plan.inactivityPeriod)} period`}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-600 font-mono">{shortenAddress(plan.address)}</p>
      </Card>
    </Link>
  );
}
