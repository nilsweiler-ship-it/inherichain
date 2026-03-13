import { useAccount } from "wagmi";
import { useHeirPlans } from "../hooks/useFactory";
import { useClaims } from "../hooks/useClaims";
import { useInheritancePlan } from "../hooks/useInheritancePlan";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { DocumentUpload } from "../components/claim/DocumentUpload";
import { ClaimCard } from "../components/claim/ClaimCard";
import { Badge } from "../components/ui/Badge";
import { useState, useEffect } from "react";
import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";
import planAbi from "../abi/InheritancePlan.json";
import type { PlanDetails, PlanConfig, Claim } from "../types";
import { formatEth, formatBasisPoints } from "../utils/formatters";
import { CONDITION_LABELS } from "../types";
import toast from "react-hot-toast";

interface HeirPlanInfo {
  plan: PlanDetails;
  heirShare: bigint;
  heirCondition: number;
  claims: { claim: Claim; id: number }[];
  accepted: boolean;
}

export function HeirDashboard() {
  const { address, isConnected } = useAccount();
  const { data: planAddresses, isLoading } = useHeirPlans(address);
  const { submitClaim, distributePhase, finalizeApproval, loading } = useClaims();
  const { acceptInheritance } = useInheritancePlan();
  const [heirPlans, setHeirPlans] = useState<HeirPlanInfo[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [cidMap, setCidMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchPlans() {
      if (!planAddresses || !address || (planAddresses as `0x${string}`[]).length === 0) {
        setHeirPlans([]);
        return;
      }
      setLoadingPlans(true);
      const results: HeirPlanInfo[] = [];
      for (const addr of planAddresses as `0x${string}`[]) {
        try {
          const data = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "getPlanDetails",
          }) as [string, string, string[], bigint, bigint, bigint, bigint, bigint, bigint, boolean, PlanConfig, boolean, boolean];

          const plan: PlanDetails = {
            address: addr,
            owner: data[0] as `0x${string}`,
            planName: data[1],
            verifiers: data[2] as `0x${string}`[],
            inactivityPeriod: data[3],
            lastCheckIn: data[4],
            balance: data[5],
            heirCount: data[6],
            claimCount: data[7],
            totalShareAllocated: data[8],
            isInactive: data[9],
            config: {
              requiredApprovals: data[10].requiredApprovals,
              totalVerifiers: data[10].totalVerifiers,
              verifierBond: data[10].verifierBond,
              challengePeriod: data[10].challengePeriod,
              challengeStake: data[10].challengeStake,
              gracePeriod: data[10].gracePeriod,
              recoveryAddress: data[10].recoveryAddress as `0x${string}`,
              phase2Delay: (data[10] as PlanConfig).phase2Delay ?? 0n,
              phase3Delay: (data[10] as PlanConfig).phase3Delay ?? 0n,
              autoRelease: (data[10] as PlanConfig).autoRelease ?? false,
            },
            gracePeriodActive: data[11],
            recoveryExtensionUsed: data[12],
          };

          const heirs = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "getAllHeirs",
          }) as { wallet: string; sharePercentage: bigint; condition: number }[];

          const myHeir = heirs.find(
            (h) => h.wallet.toLowerCase() === address.toLowerCase()
          );

          const accepted = await readContract(config, {
            address: addr,
            abi: planAbi,
            functionName: "heirAccepted",
            args: [address],
          }) as boolean;

          const claims: { claim: Claim; id: number }[] = [];
          const claimCount = Number(data[7]);
          for (let i = 0; i < claimCount; i++) {
            const claim = await readContract(config, {
              address: addr,
              abi: planAbi,
              functionName: "getClaimInfo",
              args: [BigInt(i)],
            }) as Claim;
            if (claim.heir.toLowerCase() === address.toLowerCase()) {
              claims.push({ claim, id: i });
            }
          }

          results.push({
            plan,
            heirShare: myHeir?.sharePercentage ?? 0n,
            heirCondition: myHeir?.condition ?? 0,
            claims,
            accepted,
          });
        } catch {
          // skip
        }
      }
      setHeirPlans(results);
      setLoadingPlans(false);
    }
    fetchPlans();
  }, [planAddresses, address]);

  async function handleSubmitClaim(planAddress: `0x${string}`) {
    const cid = cidMap[planAddress];
    if (!cid) {
      toast.error("Upload a document first");
      return;
    }
    try {
      await submitClaim(planAddress, cid);
      toast.success("Claim submitted!");
      window.location.reload();
    } catch {
      toast.error("Failed to submit claim");
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">Connect your wallet to view heir plans.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-8">Heir Dashboard</h1>

      {(isLoading || loadingPlans) ? (
        <Spinner />
      ) : heirPlans.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">You are not listed as an heir on any plans.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {heirPlans.map(({ plan, heirShare, heirCondition, claims, accepted }) => (
            <Card key={plan.address} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gold">{plan.planName}</h2>
                <div className="flex gap-2">
                  <Badge variant={accepted ? "success" : "warning"}>
                    {accepted ? "Accepted" : "Pending Acceptance"}
                  </Badge>
                  <Badge variant={plan.isInactive ? "danger" : "success"}>
                    {plan.isInactive ? "Owner Inactive" : "Owner Active"}
                  </Badge>
                </div>
              </div>

              {/* Heir acceptance */}
              {!accepted && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 space-y-2">
                  <p className="text-yellow-400 text-sm">
                    You have been invited as an heir to this plan. Accept to be eligible for claims.
                  </p>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await acceptInheritance(plan.address);
                        toast.success("Inheritance accepted!");
                        window.location.reload();
                      } catch {
                        toast.error("Failed to accept inheritance");
                      }
                    }}
                  >
                    Accept Inheritance
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Plan Balance</p>
                  <p className="font-bold">{formatEth(plan.balance)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Your Share</p>
                  <p className="font-bold">{formatBasisPoints(heirShare)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Condition</p>
                  <p className="font-bold">{CONDITION_LABELS[heirCondition as keyof typeof CONDITION_LABELS]}</p>
                </div>
                <div>
                  <p className="text-gray-500">Verification</p>
                  <p className="font-bold">{Number(plan.config.requiredApprovals)}-of-{Number(plan.config.totalVerifiers)}</p>
                </div>
              </div>

              {/* Existing claims with phase tracker */}
              {claims.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-gray-400">Your Claims</h3>
                  {claims.map(({ claim, id }) => (
                    <ClaimCard
                      key={id}
                      claim={claim}
                      claimId={id}
                      isClaimant={true}
                      onDistributePhase={(cid, phase) => {
                        distributePhase(plan.address, cid, phase)
                          .then(() => { toast.success("Phase claimed!"); window.location.reload(); })
                          .catch(() => toast.error("Distribution failed"));
                      }}
                      onFinalizeApproval={(cid) => {
                        finalizeApproval(plan.address, cid)
                          .then(() => { toast.success("Finalized!"); window.location.reload(); })
                          .catch(() => toast.error("Finalization failed"));
                      }}
                      loading={loading}
                    />
                  ))}
                </div>
              )}

              {/* Submit new claim if inactive and accepted */}
              {plan.isInactive && accepted && (
                <div className="border-t border-gray-700 pt-4 space-y-3">
                  <h3 className="text-sm font-bold text-gray-400">Submit New Claim</h3>
                  <DocumentUpload onUpload={(cid) => setCidMap((m) => ({ ...m, [plan.address]: cid }))} />
                  {cidMap[plan.address] && (
                    <p className="text-xs text-gray-500">CID: {cidMap[plan.address]}</p>
                  )}
                  <Button
                    onClick={() => handleSubmitClaim(plan.address)}
                    loading={loading}
                    disabled={!cidMap[plan.address]}
                    size="sm"
                  >
                    Submit Claim
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
