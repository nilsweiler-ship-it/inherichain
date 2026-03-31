import { useAccount } from "wagmi";
import { useVerifierPlans } from "../hooks/useFactory";
import { useVerification } from "../hooks/useVerification";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { VerificationCard } from "../components/verification/VerificationCard";
import { useState, useEffect, useCallback } from "react";
import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";
import planAbi from "../abi/InheritancePlan.json";
import type { Claim } from "../types";
import toast from "react-hot-toast";

interface PendingClaim {
  planAddress: `0x${string}`;
  planName: string;
  claimId: number;
  claim: Claim;
  hasVoted: boolean;
}

export function VerifierPanel() {
  const { address, isConnected } = useAccount();
  const { data: planAddresses, isLoading } = useVerifierPlans(address);
  const { vote, loading } = useVerification();
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [fetchVersion, setFetchVersion] = useState(0);

  const fetchClaims = useCallback(async () => {
    if (!planAddresses || !address || (planAddresses as `0x${string}`[]).length === 0) {
      setPendingClaims([]);
      return;
    }
    setLoadingClaims(true);
    const results: PendingClaim[] = [];
    for (const addr of planAddresses as `0x${string}`[]) {
      try {
        const details = await readContract(config, {
          address: addr,
          abi: planAbi,
          functionName: "getPlanDetails",
        }) as [string, string, [string, string, string], bigint, bigint, bigint, bigint, bigint, bigint, boolean];

        const claimCount = Number(details[7]);
        for (let i = 0; i < claimCount; i++) {
          const claim = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "getClaimInfo",
            args: [BigInt(i)],
          }) as Claim;

          const hasVoted = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "verifierVoted",
            args: [BigInt(i), address],
          }) as boolean;

          results.push({
            planAddress: addr,
            planName: details[1],
            claimId: i,
            claim,
            hasVoted,
          });
        }
      } catch (err) {
        console.error(`Failed to fetch claims for plan ${addr}:`, err);
        toast.error(`Failed to load claims for a plan`);
      }
    }
    setPendingClaims(results);
    setLoadingClaims(false);
  }, [planAddresses, address]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims, fetchVersion]);

  async function handleVote(planAddress: string, claimId: number, approve: boolean) {
    try {
      await vote(planAddress as `0x${string}`, claimId, approve);
      toast.success(approve ? "Approved!" : "Rejected!");
      setFetchVersion((v) => v + 1);
    } catch (err) {
      console.error("Vote failed:", err);
      toast.error("Vote failed");
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">Connect your wallet to view verifier duties.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-8">Verifier Panel</h1>

      {(isLoading || loadingClaims) ? (
        <Spinner />
      ) : pendingClaims.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">No claims to review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingClaims.map((pc) => (
            <VerificationCard
              key={`${pc.planAddress}-${pc.claimId}`}
              claim={pc.claim}
              claimId={pc.claimId}
              planAddress={pc.planAddress}
              planName={pc.planName}
              onVote={handleVote}
              loading={loading}
              hasVoted={pc.hasVoted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
