import { Button } from "../ui/Button";
import { Check, X } from "lucide-react";

interface ApproveRejectButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ApproveRejectButtons({ onApprove, onReject, loading, disabled }: ApproveRejectButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        onClick={onApprove}
        loading={loading}
        disabled={disabled}
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <Check className="w-4 h-4 mr-1" /> Approve
      </Button>
      <Button
        variant="danger"
        onClick={onReject}
        loading={loading}
        disabled={disabled}
        size="sm"
      >
        <X className="w-4 h-4 mr-1" /> Reject
      </Button>
    </div>
  );
}
