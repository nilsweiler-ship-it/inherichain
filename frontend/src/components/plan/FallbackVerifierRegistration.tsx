import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useFallbackPool, useIsRegisteredFallback, useFallbackVerifierInfo } from "../../hooks/useVerification";
import { formatEth } from "../../utils/formatters";
import toast from "react-hot-toast";

interface Props {
  poolAddress: `0x${string}`;
}

export function FallbackVerifierRegistration({ poolAddress }: Props) {
  const { address } = useAccount();
  const { poolSize, activeCount, registerAsFallbackVerifier, withdrawFromPool, loading } = useFallbackPool(poolAddress);
  const { data: isRegistered } = useIsRegisteredFallback(poolAddress, address);
  const { verifierInfo } = useFallbackVerifierInfo(poolAddress, address);
  const [stakeAmount, setStakeAmount] = useState("0.1");

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gold">Fallback Verifier Pool</h2>
        <div className="flex gap-2">
          <Badge variant="info">Pool: {poolSize?.toString() ?? "0"}</Badge>
          <Badge variant="success">Active: {activeCount?.toString() ?? "0"}</Badge>
        </div>
      </div>

      {isRegistered ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Your Stake</p>
              <p className="font-bold">{verifierInfo ? formatEth(verifierInfo.stake) : "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Assigned Plans</p>
              <p className="font-bold">{verifierInfo?.assignedPlans?.toString() ?? "0"}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await withdrawFromPool();
                toast.success("Withdrawn from pool!");
                window.location.reload();
              } catch {
                toast.error("Withdrawal failed (may be assigned to plans)");
              }
            }}
            loading={loading}
          >
            Withdraw from Pool
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Register as a fallback verifier to earn fees by verifying claims when original verifiers are unavailable.
            Minimum stake: 0.1 ETH.
          </p>
          <Input
            label="Stake Amount (ETH, min 0.1)"
            type="number"
            step="0.1"
            min="0.1"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
          />
          <Button
            onClick={async () => {
              try {
                await registerAsFallbackVerifier(parseEther(stakeAmount));
                toast.success("Registered as fallback verifier!");
                window.location.reload();
              } catch {
                toast.error("Registration failed");
              }
            }}
            loading={loading}
            disabled={parseFloat(stakeAmount) < 0.1}
          >
            Register as Fallback Verifier
          </Button>
        </div>
      )}
    </Card>
  );
}
