import { useParams } from "react-router";
import { useAccount } from "wagmi";
import { usePlanDetails, usePlanHeirs, useTimeUntilInactive, useInheritancePlan } from "../hooks/useInheritancePlan";
import { useCheckIn } from "../hooks/useCheckIn";
import { useClaims, useClaimCount } from "../hooks/useClaims";
import { useVerification } from "../hooks/useVerification";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { ClaimCard } from "../components/claim/ClaimCard";
import { DocumentUpload } from "../components/claim/DocumentUpload";
import { ApproveRejectButtons } from "../components/verification/ApproveRejectButtons";
import { formatEth, formatBasisPoints, formatTimeRemaining, shortenAddress } from "../utils/formatters";
import { CONDITION_LABELS } from "../types";
import type { Claim } from "../types";
import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";
import planAbi from "../abi/InheritancePlan.json";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";

export function PlanDetailPage() {
  const { address: planAddr } = useParams<{ address: string }>();
  const planAddress = planAddr as `0x${string}`;
  const { address: userAddress } = useAccount();
  const { planDetails, isLoading } = usePlanDetails(planAddress);
  const { heirs } = usePlanHeirs(planAddress);
  const { data: timeLeft } = useTimeUntilInactive(planAddress);
  const { checkIn, loading: checkInLoading } = useCheckIn();
  const { submitClaim, distributePhase, finalizeApproval, cancelClaimAsOwner, loading: claimLoading } = useClaims();
  const { vote, stakeAsVerifier, raiseChallenge, withdrawVerifierBond, loading: voteLoading } = useVerification();
  const { revokePlan, removeHeir } = useInheritancePlan();
  const { data: claimCount } = useClaimCount(planAddress);
  const [claims, setClaims] = useState<{ claim: Claim; id: number }[]>([]);
  const [docCid, setDocCid] = useState("");

  const isOwner = userAddress && planDetails?.owner?.toLowerCase() === userAddress.toLowerCase();
  const isVerifier = userAddress && planDetails?.verifiers?.some(
    (v) => v.toLowerCase() === userAddress.toLowerCase()
  );
  const isHeirUser = userAddress && heirs.some(
    (h) => h.wallet.toLowerCase() === userAddress.toLowerCase()
  );

  useEffect(() => {
    async function fetchClaims() {
      if (!claimCount || !planAddress) return;
      const count = Number(claimCount);
      const results: { claim: Claim; id: number }[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const claim = await readContract(config, {
            address: planAddress,
            abi: planAbi,
            functionName: "getClaimInfo",
            args: [BigInt(i)],
          }) as Claim;
          results.push({ claim, id: i });
        } catch {
          // skip
        }
      }
      setClaims(results);
    }
    fetchClaims();
  }, [claimCount, planAddress]);

  if (isLoading) return <Spinner />;
  if (!planDetails) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-gray-400">Plan not found.</p>
        </Card>
      </div>
    );
  }

  const cfg = planDetails.config;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gold">{planDetails.planName}</h1>
          <p className="text-sm text-gray-500 font-mono">{planAddress}</p>
        </div>
        <Badge variant={planDetails.isInactive ? "danger" : "success"}>
          {planDetails.isInactive ? "Inactive" : "Active"}
        </Badge>
      </div>

      {/* Grace period banner */}
      {planDetails.gracePeriodActive && (
        <Card className="bg-yellow-900/20 border-yellow-600/30">
          <p className="text-yellow-400 text-sm">
            Grace period is active. The inactivity deadline has been extended by {Number(cfg.gracePeriod) / 86400} days.
          </p>
        </Card>
      )}

      {/* Plan overview */}
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-gold">Plan Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Balance</p>
            <p className="font-bold">{formatEth(planDetails.balance)}</p>
          </div>
          <div>
            <p className="text-gray-500">Owner</p>
            <p className="font-bold font-mono">{shortenAddress(planDetails.owner)}</p>
          </div>
          <div>
            <p className="text-gray-500">Time Until Inactive</p>
            <p className="font-bold">{timeLeft ? formatTimeRemaining(timeLeft as bigint) : "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Share Allocated</p>
            <p className="font-bold">{formatBasisPoints(planDetails.totalShareAllocated)}</p>
          </div>
          <div>
            <p className="text-gray-500">Verification</p>
            <p className="font-bold">{Number(cfg.requiredApprovals)}-of-{Number(cfg.totalVerifiers)}</p>
          </div>
          <div>
            <p className="text-gray-500">Challenge Period</p>
            <p className="font-bold">{Number(cfg.challengePeriod) / 86400}d</p>
          </div>
          <div>
            <p className="text-gray-500">Verifier Bond</p>
            <p className="font-bold">{formatEth(cfg.verifierBond)}</p>
          </div>
          <div>
            <p className="text-gray-500">Challenge Stake</p>
            <p className="font-bold">{formatEth(cfg.challengeStake)}</p>
          </div>
          <div>
            <p className="text-gray-500">Phase 2 Delay</p>
            <p className="font-bold">{Number(cfg.phase2Delay) / 86400}d</p>
          </div>
          <div>
            <p className="text-gray-500">Phase 3 Delay</p>
            <p className="font-bold">{Number(cfg.phase3Delay) / 86400}d</p>
          </div>
          <div>
            <p className="text-gray-500">Auto-Release</p>
            <p className="font-bold">{cfg.autoRelease ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-gray-500">Claims</p>
            <p className="font-bold">{Number(planDetails.claimCount)}</p>
          </div>
        </div>

        {/* Verifiers */}
        <div>
          <p className="text-gray-500 text-sm mb-1">Verifiers</p>
          <div className="space-y-1">
            {planDetails.verifiers.map((v, i) => (
              <p key={i} className="text-xs font-mono text-gray-400">{v}</p>
            ))}
          </div>
        </div>
      </Card>

      {/* Owner actions */}
      {isOwner && !planDetails.isInactive && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold text-gold">Owner Actions</h2>
          <div className="flex gap-3">
            <Button
              onClick={async () => {
                try {
                  await checkIn(planAddress);
                  toast.success("Checked in!");
                } catch {
                  toast.error("Check-in failed");
                }
              }}
              loading={checkInLoading}
            >
              Check In
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!confirm("Are you sure you want to revoke this plan? This will cancel all pending claims and return remaining funds.")) return;
                try {
                  await revokePlan(planAddress);
                  toast.success("Plan revoked!");
                  window.location.reload();
                } catch {
                  toast.error("Revoke failed");
                }
              }}
            >
              Revoke Plan
            </Button>
          </div>
        </Card>
      )}

      {/* Verifier staking panel */}
      {isVerifier && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold text-gold">Verifier Panel</h2>
          <div className="flex gap-3">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await stakeAsVerifier(planAddress, cfg.verifierBond);
                  toast.success("Staked!");
                  window.location.reload();
                } catch {
                  toast.error("Staking failed");
                }
              }}
              loading={voteLoading}
            >
              Stake Bond ({formatEth(cfg.verifierBond)})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await withdrawVerifierBond(planAddress);
                  toast.success("Bond withdrawn!");
                  window.location.reload();
                } catch {
                  toast.error("Withdrawal failed");
                }
              }}
              loading={voteLoading}
            >
              Withdraw Bond
            </Button>
          </div>
        </Card>
      )}

      {/* Heirs */}
      <Card className="space-y-3">
        <h2 className="text-lg font-bold text-gold">Heirs</h2>
        {heirs.length === 0 ? (
          <p className="text-gray-400 text-sm">No heirs added yet.</p>
        ) : (
          <div className="space-y-2">
            {heirs.map((heir, i) => (
              <div key={i} className="flex items-center justify-between bg-navy rounded-lg p-3 border border-gray-700">
                <div>
                  <p className="text-sm font-mono text-gray-300">{shortenAddress(heir.wallet)}</p>
                  <p className="text-xs text-gray-500">
                    {CONDITION_LABELS[heir.condition]}
                    {heir.condition === 4 && ` (age ${Number(heir.ageThreshold)})`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gold font-bold">{formatBasisPoints(heir.sharePercentage)}</span>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (!confirm(`Remove heir ${shortenAddress(heir.wallet)}?`)) return;
                        try {
                          await removeHeir(planAddress, heir.wallet);
                          toast.success("Heir removed!");
                          window.location.reload();
                        } catch {
                          toast.error("Failed to remove heir");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Claims */}
      <Card className="space-y-3">
        <h2 className="text-lg font-bold text-gold">Claims</h2>
        {claims.length === 0 ? (
          <p className="text-gray-400 text-sm">No claims submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {claims.map(({ claim, id }) => (
              <div key={id} className="space-y-2">
                <ClaimCard
                  claim={claim}
                  claimId={id}
                  isClaimant={userAddress?.toLowerCase() === claim.heir.toLowerCase()}
                  isOwner={!!isOwner}
                  onDistributePhase={(cid, phase) => {
                    distributePhase(planAddress, cid, phase)
                      .then(() => { toast.success("Phase claimed!"); window.location.reload(); })
                      .catch(() => toast.error("Distribution failed"));
                  }}
                  onFinalizeApproval={(cid) => {
                    finalizeApproval(planAddress, cid)
                      .then(() => { toast.success("Finalized!"); window.location.reload(); })
                      .catch(() => toast.error("Finalization failed"));
                  }}
                  onCancelClaim={(cid) => {
                    cancelClaimAsOwner(planAddress, cid)
                      .then(() => { toast.success("Cancelled!"); window.location.reload(); })
                      .catch(() => toast.error("Cancel failed"));
                  }}
                  onRaiseChallenge={(cid) => {
                    raiseChallenge(planAddress, cid, cfg.challengeStake)
                      .then(() => { toast.success("Challenge raised!"); window.location.reload(); })
                      .catch(() => toast.error("Challenge failed"));
                  }}
                  loading={claimLoading || voteLoading}
                />
                {isVerifier && claim.status === 1 && (
                  <ApproveRejectButtons
                    onApprove={() => {
                      vote(planAddress, id, true)
                        .then(() => { toast.success("Approved!"); window.location.reload(); })
                        .catch(() => toast.error("Vote failed"));
                    }}
                    onReject={() => {
                      vote(planAddress, id, false)
                        .then(() => { toast.success("Rejected!"); window.location.reload(); })
                        .catch(() => toast.error("Vote failed"));
                    }}
                    loading={voteLoading}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Heir submit claim */}
      {isHeirUser && planDetails.isInactive && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold text-gold">Submit Claim</h2>
          <DocumentUpload onUpload={setDocCid} />
          {docCid && <p className="text-xs text-gray-500">CID: {docCid}</p>}
          <Button
            onClick={async () => {
              try {
                await submitClaim(planAddress, docCid);
                toast.success("Claim submitted!");
                window.location.reload();
              } catch {
                toast.error("Claim failed");
              }
            }}
            loading={claimLoading}
            disabled={!docCid}
          >
            Submit Claim
          </Button>
        </Card>
      )}
    </div>
  );
}
