import { useState } from "react";
import { useNavigate } from "react-router";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { StepIndicator } from "./StepIndicator";
import { ConditionSelector } from "./ConditionSelector";
import { HeirRow } from "./HeirRow";
import { useFactory } from "../../hooks/useFactory";
import { useInheritancePlan } from "../../hooks/useInheritancePlan";
import { ConditionType } from "../../types";
import type { HeirFormData, PlanConfig } from "../../types";
import {
  MIN_INACTIVITY_DAYS,
  BASIS_POINTS,
  DEFAULT_VERIFIER_BOND,
  DEFAULT_CHALLENGE_STAKE,
  DEFAULT_CHALLENGE_PERIOD_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  MIN_CHALLENGE_PERIOD_DAYS,
  PHASE2_DELAY_DAYS,
  PHASE3_DELAY_DAYS,
} from "../../utils/constants";

const STEPS = ["Plan Details", "Verifiers & Staking", "Security Settings", "Heirs", "Review", "Fund"];

export function CreatePlanForm() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { createPlan } = useFactory();
  const { addHeirToPlan, registerHeirOnFactory, setBackupHeir: setBackupHeirOnPlan, addChallenger: addChallengerOnPlan } = useInheritancePlan();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Plan Details
  const [planName, setPlanName] = useState("");
  const [inactivityDays, setInactivityDays] = useState(60);
  const [gracePeriodDays, setGracePeriodDays] = useState(DEFAULT_GRACE_PERIOD_DAYS);
  const [recoveryAddress, setRecoveryAddress] = useState("");

  // Step 2: Verifiers & Staking
  const [verifierAddresses, setVerifierAddresses] = useState<string[]>(["", "", ""]);
  const [requiredApprovals, setRequiredApprovals] = useState(2);
  const [verifierBond, setVerifierBond] = useState(DEFAULT_VERIFIER_BOND);

  // Step 3: Security Settings
  const [challengePeriodDays, setChallengePeriodDays] = useState(DEFAULT_CHALLENGE_PERIOD_DAYS);
  const [challengeStake, setChallengeStake] = useState(DEFAULT_CHALLENGE_STAKE);
  const [phase2DelayDays, setPhase2DelayDays] = useState(PHASE2_DELAY_DAYS);
  const [phase3DelayDays, setPhase3DelayDays] = useState(PHASE3_DELAY_DAYS);
  const [autoRelease, setAutoRelease] = useState(false);
  const [backupHeirAddress, setBackupHeirAddress] = useState("");
  const [challengerAddresses, setChallengerAddresses] = useState<string[]>([]);

  // Step 4: Heirs
  const [heirs, setHeirs] = useState<HeirFormData[]>([]);
  const [newHeirWallet, setNewHeirWallet] = useState("");
  const [newHeirShare, setNewHeirShare] = useState(5000);
  const [newHeirCondition, setNewHeirCondition] = useState<ConditionType>(ConditionType.Death);
  const [newHeirAge, setNewHeirAge] = useState(0);
  const [newHeirDetail, setNewHeirDetail] = useState("");

  // Step 6: Funding
  const [fundAmount, setFundAmount] = useState("1");

  const totalShares = heirs.reduce((sum, h) => sum + h.sharePercentage, 0);
  const validVerifiers = verifierAddresses.filter((v) => v.trim().length > 0);

  function addVerifierSlot() {
    setVerifierAddresses([...verifierAddresses, ""]);
  }

  function removeVerifierSlot(index: number) {
    if (verifierAddresses.length <= 2) return;
    setVerifierAddresses(verifierAddresses.filter((_, i) => i !== index));
  }

  function updateVerifier(index: number, value: string) {
    const updated = [...verifierAddresses];
    updated[index] = value;
    setVerifierAddresses(updated);
  }

  function addHeir() {
    if (!newHeirWallet || newHeirShare <= 0) {
      toast.error("Fill in heir details");
      return;
    }
    if (totalShares + newHeirShare > BASIS_POINTS) {
      toast.error("Total shares would exceed 100%");
      return;
    }
    setHeirs([
      ...heirs,
      {
        wallet: newHeirWallet,
        sharePercentage: newHeirShare,
        condition: newHeirCondition,
        ageThreshold: newHeirAge,
        conditionDetail: newHeirDetail,
      },
    ]);
    setNewHeirWallet("");
    setNewHeirShare(5000);
    setNewHeirCondition(ConditionType.Death);
    setNewHeirAge(0);
    setNewHeirDetail("");
  }

  function removeHeir(index: number) {
    setHeirs(heirs.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    setLoading(true);
    try {
      const inactivitySeconds = BigInt(inactivityDays * 86400);
      const verifiers = validVerifiers.map((v) => v as `0x${string}`);

      const planConfig: PlanConfig = {
        requiredApprovals: BigInt(requiredApprovals),
        totalVerifiers: BigInt(verifiers.length),
        verifierBond: parseEther(verifierBond),
        challengePeriod: BigInt(challengePeriodDays * 86400),
        challengeStake: parseEther(challengeStake),
        gracePeriod: BigInt(gracePeriodDays * 86400),
        recoveryAddress: (recoveryAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`,
        phase2Delay: BigInt(phase2DelayDays * 86400),
        phase3Delay: BigInt(phase3DelayDays * 86400),
        autoRelease,
      };

      const planAddress = await createPlan(planName, verifiers, inactivitySeconds, planConfig);
      if (!planAddress) throw new Error("Plan creation failed");

      for (const heir of heirs) {
        await addHeirToPlan(
          planAddress,
          heir.wallet as `0x${string}`,
          BigInt(heir.sharePercentage),
          heir.condition,
          BigInt(heir.ageThreshold),
          heir.conditionDetail
        );
        await registerHeirOnFactory(planAddress, heir.wallet as `0x${string}`);
      }

      if (backupHeirAddress.trim()) {
        await setBackupHeirOnPlan(planAddress, backupHeirAddress as `0x${string}`);
      }

      for (const addr of challengerAddresses.filter(a => a.trim())) {
        await addChallengerOnPlan(planAddress, addr as `0x${string}`);
      }

      if (parseFloat(fundAmount) > 0) {
        const { sendTransaction, waitForTransactionReceipt } = await import("@wagmi/core");
        const { config } = await import("../../config/wagmi");
        const hash = await sendTransaction(config, {
          to: planAddress,
          value: parseEther(fundAmount),
        });
        await waitForTransactionReceipt(config, { hash });
      }

      toast.success("Plan created successfully!");
      navigate("/dashboard/owner");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create plan";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator steps={STEPS} currentStep={step} />

      {/* Step 1: Plan Details */}
      {step === 0 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Plan Details</h2>
          <Input
            label="Plan Name"
            placeholder="My Inheritance Plan"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
          />
          <Input
            label={`Inactivity Period (days, min ${MIN_INACTIVITY_DAYS})`}
            type="number"
            min={MIN_INACTIVITY_DAYS}
            value={inactivityDays}
            onChange={(e) => setInactivityDays(Number(e.target.value))}
          />
          <Input
            label="Grace Period (days, 0 to disable)"
            type="number"
            min={0}
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(Number(e.target.value))}
          />
          <Input
            label="Recovery Address (optional, can extend check-in once)"
            placeholder="0x..."
            value={recoveryAddress}
            onChange={(e) => setRecoveryAddress(e.target.value)}
          />
          <Button onClick={() => setStep(1)} disabled={!planName || inactivityDays < MIN_INACTIVITY_DAYS}>
            Next
          </Button>
        </Card>
      )}

      {/* Step 2: Verifiers & Staking */}
      {step === 1 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Verifiers & Staking</h2>
          <p className="text-sm text-gray-400">
            Choose your verifiers (M-of-N). At least 2 required.
          </p>
          {verifierAddresses.map((v, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label={`Verifier ${i + 1}`}
                  placeholder="0x..."
                  value={v}
                  onChange={(e) => updateVerifier(i, e.target.value)}
                />
              </div>
              {verifierAddresses.length > 2 && (
                <Button variant="danger" size="sm" onClick={() => removeVerifierSlot(i)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addVerifierSlot}>
            + Add Verifier
          </Button>
          <Input
            label={`Required Approvals (M of ${validVerifiers.length})`}
            type="number"
            min={1}
            max={validVerifiers.length}
            value={requiredApprovals}
            onChange={(e) => setRequiredApprovals(Number(e.target.value))}
          />
          <Input
            label="Verifier Bond (ETH each)"
            type="number"
            step="0.1"
            min="0"
            value={verifierBond}
            onChange={(e) => setVerifierBond(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button
              onClick={() => setStep(2)}
              disabled={validVerifiers.length < 2 || requiredApprovals < 1 || requiredApprovals > validVerifiers.length}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Security Settings */}
      {step === 2 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Security Settings</h2>
          <p className="text-sm text-gray-400">
            Configure the challenge period, distribution delays, and advanced options.
          </p>
          <Input
            label={`Challenge Period (days, min ${MIN_CHALLENGE_PERIOD_DAYS})`}
            type="number"
            min={MIN_CHALLENGE_PERIOD_DAYS}
            value={challengePeriodDays}
            onChange={(e) => setChallengePeriodDays(Number(e.target.value))}
          />
          <Input
            label="Challenge Stake (ETH)"
            type="number"
            step="0.1"
            min="0"
            value={challengeStake}
            onChange={(e) => setChallengeStake(e.target.value)}
          />
          <Input
            label="Phase 2 Distribution Delay (days)"
            type="number"
            min={1}
            value={phase2DelayDays}
            onChange={(e) => setPhase2DelayDays(Number(e.target.value))}
          />
          <Input
            label="Phase 3 Distribution Delay (days)"
            type="number"
            min={1}
            value={phase3DelayDays}
            onChange={(e) => setPhase3DelayDays(Number(e.target.value))}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoRelease"
              checked={autoRelease}
              onChange={(e) => setAutoRelease(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoRelease" className="text-sm text-gray-300">
              Auto-release: allow anyone to trigger distribution after delay
            </label>
          </div>
          <Input
            label="Backup Heir Address (optional)"
            placeholder="0x..."
            value={backupHeirAddress}
            onChange={(e) => setBackupHeirAddress(e.target.value)}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Pre-approved Challengers (optional)</label>
            {challengerAddresses.map((addr, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="0x..."
                  value={addr}
                  onChange={(e) => {
                    const updated = [...challengerAddresses];
                    updated[i] = e.target.value;
                    setChallengerAddresses(updated);
                  }}
                />
                <Button variant="danger" size="sm" onClick={() => setChallengerAddresses(challengerAddresses.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setChallengerAddresses([...challengerAddresses, ""])}>
              + Add Challenger
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={challengePeriodDays < MIN_CHALLENGE_PERIOD_DAYS}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Heirs */}
      {step === 3 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Heirs</h2>
          <p className="text-sm text-gray-400">
            Allocated: {(totalShares / 100).toFixed(2)}% of 100%
          </p>
          {heirs.map((heir, i) => (
            <HeirRow key={i} heir={heir} index={i} onRemove={removeHeir} />
          ))}
          <div className="space-y-3 border-t border-gray-700 pt-4">
            <Input label="Wallet Address" placeholder="0x..." value={newHeirWallet} onChange={(e) => setNewHeirWallet(e.target.value)} />
            <Input
              label="Share (basis points, e.g. 5000 = 50%)"
              type="number"
              min={1}
              max={BASIS_POINTS - totalShares}
              value={newHeirShare}
              onChange={(e) => setNewHeirShare(Number(e.target.value))}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Condition</label>
              <ConditionSelector value={newHeirCondition} onChange={setNewHeirCondition} />
            </div>
            {newHeirCondition === ConditionType.Age && (
              <Input label="Age Threshold" type="number" value={newHeirAge} onChange={(e) => setNewHeirAge(Number(e.target.value))} />
            )}
            <Input label="Condition Detail" placeholder="Description..." value={newHeirDetail} onChange={(e) => setNewHeirDetail(e.target.value)} />
            <Button variant="secondary" onClick={addHeir}>
              Add Heir
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)} disabled={heirs.length === 0}>Next</Button>
          </div>
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 4 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Review</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Plan:</span> {planName}</p>
            <p><span className="text-gray-400">Inactivity:</span> {inactivityDays} days</p>
            <p><span className="text-gray-400">Grace Period:</span> {gracePeriodDays} days</p>
            {recoveryAddress && <p><span className="text-gray-400">Recovery:</span> <span className="font-mono text-xs">{recoveryAddress}</span></p>}
            <p><span className="text-gray-400">Verification:</span> {requiredApprovals}-of-{validVerifiers.length}</p>
            <p><span className="text-gray-400">Verifier Bond:</span> {verifierBond} ETH</p>
            <p><span className="text-gray-400">Challenge Period:</span> {challengePeriodDays} days</p>
            <p><span className="text-gray-400">Challenge Stake:</span> {challengeStake} ETH</p>
            <p><span className="text-gray-400">Phase 2 Delay:</span> {phase2DelayDays} days</p>
            <p><span className="text-gray-400">Phase 3 Delay:</span> {phase3DelayDays} days</p>
            <p><span className="text-gray-400">Auto-Release:</span> {autoRelease ? "Yes" : "No"}</p>
            {backupHeirAddress && <p><span className="text-gray-400">Backup Heir:</span> <span className="font-mono text-xs">{backupHeirAddress}</span></p>}
            {challengerAddresses.filter(a => a.trim()).length > 0 && (
              <>
                <p className="text-gray-400">Pre-approved Challengers:</p>
                <ul className="list-disc list-inside text-gray-400 font-mono text-xs">
                  {challengerAddresses.filter(a => a.trim()).map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            )}
            <p className="text-gray-400">Verifiers:</p>
            <ul className="list-disc list-inside text-gray-400 font-mono text-xs">
              {validVerifiers.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
            <p><span className="text-gray-400">Heirs:</span> {heirs.length}</p>
            <p><span className="text-gray-400">Total Share:</span> {(totalShares / 100).toFixed(2)}%</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => setStep(5)}>Next</Button>
          </div>
        </Card>
      )}

      {/* Step 6: Fund */}
      {step === 5 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Fund Plan</h2>
          <Input
            label="Initial Funding (ETH)"
            type="number"
            step="0.01"
            min="0"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
            <Button onClick={handleSubmit} loading={loading}>
              Create Plan & Fund
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
