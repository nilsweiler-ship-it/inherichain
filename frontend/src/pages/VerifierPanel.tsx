import { useAccount } from "wagmi";
import { useVerifierPlans, useRegistryAddress } from "../hooks/useFactory";
import { useVerification } from "../hooks/useVerification";
import { useVerifierReputation, useVerifierStats } from "../hooks/useRegistry";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { VerificationCard } from "../components/verification/VerificationCard";
import { VerifierReputationBadge } from "../components/verification/VerifierReputationBadge";
import { FallbackVerifierRegistration } from "../components/plan/FallbackVerifierRegistration";
import { useState, useEffect } from "react";
import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";
import planAbi from "../abi/InheritancePlan.json";
import type { Claim, PlanConfig } from "../types";
import toast from "react-hot-toast";
import { formatEth } from "../utils/formatters";
import { FALLBACK_POOL_ADDRESS } from "../utils/constants";

interface PendingClaim {
  planAddress: `0x${string}`;
  planName: string;
  claimId: number;
  claim: Claim;
  hasVoted: boolean;
  requiredApprovals: number;
  totalVerifiers: number;
  verifierBond: bigint;
  isStaked: boolean;
}

export function VerifierPanel() {
  const { address, isConnected } = useAccount();
  const { data: planAddresses, isLoading } = useVerifierPlans(address);
  const { vote, stakeAsVerifier, loading } = useVerification();
  const { data: registryAddress } = useRegistryAddress();
  const { reputation } = useVerifierReputation(registryAddress as `0x${string}` | undefined, address);
  const { stats } = useVerifierStats(registryAddress as `0x${string}` | undefined, address);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  useEffect(() => {
    async function fetchClaims() {
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
          }) as [string, string, string[], bigint, bigint, bigint, bigint, bigint, bigint, boolean, PlanConfig, boolean, boolean];

          const planConfig = details[10];
          const claimCount = Number(details[7]);

          const isStaked = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "verifierBonds",
            args: [address],
          }) as bigint;

          for (let i = 0; i < claimCount; i++) {
            const claim = await readContract(config, {
              address: addr,
              abi: planAbi,
              functionName: "getClaimInfo",
              args: [BigInt(i)],
            }) as Claim;

            const voteRound = Number(claim.voteRound);
            const hasVoted = await readContract(config, {
              address: addr,
              abi: planAbi,
              functionName: "verifierVoted",
              args: [BigInt(i), BigInt(voteRound), address],
            }) as boolean;

            results.push({
              planAddress: addr,
              planName: details[1],
              claimId: i,
              claim,
              hasVoted,
              requiredApprovals: Number(planConfig.requiredApprovals),
              totalVerifiers: Number(planConfig.totalVerifiers),
              verifierBond: planConfig.verifierBond,
              isStaked: isStaked >= planConfig.verifierBond,
            });
          }
        } catch {
          // skip
        }
      }
      setPendingClaims(results);
      setLoadingClaims(false);
    }
    fetchClaims();
  }, [planAddresses, address]);

  async function handleVote(planAddress: string, claimId: number, approve: boolean) {
    try {
      await vote(planAddress as `0x${string}`, claimId, approve);
      toast.success(approve ? "Approved!" : "Rejected!");
      window.location.reload();
    } catch {
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gold">Verifier Panel</h1>
        <VerifierReputationBadge reputation={reputation} stats={stats} />
      </div>

      {/* Fallback Verifier Pool */}
      {FALLBACK_POOL_ADDRESS !== "0x0000000000000000000000000000000000000000" && (
        <div className="mb-6">
          <FallbackVerifierRegistration poolAddress={FALLBACK_POOL_ADDRESS} />
        </div>
      )}

      {(isLoading || loadingClaims) ? (
        <Spinner />
      ) : pendingClaims.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">No claims to review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingClaims.map((pc) => (
            <div key={`${pc.planAddress}-${pc.claimId}`} className="space-y-2">
              {!pc.isStaked && (
                <Card className="bg-yellow-900/20 border-yellow-600/30 flex items-center justify-between">
                  <p className="text-yellow-400 text-sm">
                    You need to stake {formatEth(pc.verifierBond)} to vote on this plan.
                  </p>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await stakeAsVerifier(pc.planAddress, pc.verifierBond);
                        toast.success("Staked!");
                        window.location.reload();
                      } catch {
                        toast.error("Staking failed");
                      }
                    }}
                    loading={loading}
                  >
                    Stake
                  </Button>
                </Card>
              )}
              <VerificationCard
                claim={pc.claim}
                claimId={pc.claimId}
                planAddress={pc.planAddress}
                planName={pc.planName}
                requiredApprovals={pc.requiredApprovals}
                totalVerifiers={pc.totalVerifiers}
                onVote={handleVote}
                loading={loading}
                hasVoted={pc.hasVoted}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
