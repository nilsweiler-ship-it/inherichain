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
import type { HeirFormData } from "../../types";
import { MIN_INACTIVITY_DAYS, BASIS_POINTS } from "../../utils/constants";
import { isAddress } from "viem";

const STEPS = ["Plan Details", "Verifiers", "Heirs", "Review & Fund"];

export function CreatePlanForm() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { createPlan } = useFactory();
  const { addHeirToPlan, registerHeirOnFactory } = useInheritancePlan();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Plan Details
  const [planName, setPlanName] = useState("");
  const [inactivityDays, setInactivityDays] = useState(60);

  // Step 2: Verifiers
  const [verifier1, setVerifier1] = useState("");
  const [verifier2, setVerifier2] = useState("");
  const [verifier3, setVerifier3] = useState("");

  // Step 3: Heirs
  const [heirs, setHeirs] = useState<HeirFormData[]>([]);
  const [newHeirWallet, setNewHeirWallet] = useState("");
  const [newHeirShare, setNewHeirShare] = useState(5000);
  const [newHeirCondition, setNewHeirCondition] = useState<ConditionType>(ConditionType.Death);
  const [newHeirAge, setNewHeirAge] = useState(0);
  const [newHeirDetail, setNewHeirDetail] = useState("");

  // Step 4: Funding
  const [fundAmount, setFundAmount] = useState("1");

  const totalShares = heirs.reduce((sum, h) => sum + h.sharePercentage, 0);

  function addHeir() {
    if (!newHeirWallet || newHeirShare <= 0) {
      toast.error("Fill in heir details");
      return;
    }
    if (!isAddress(newHeirWallet)) {
      toast.error("Invalid Ethereum address for heir");
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
      const planAddress = await createPlan(
        planName,
        [verifier1 as `0x${string}`, verifier2 as `0x${string}`, verifier3 as `0x${string}`],
        inactivitySeconds
      );

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
          <Button onClick={() => setStep(1)} disabled={!planName || inactivityDays < MIN_INACTIVITY_DAYS}>
            Next
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Verifiers (2-of-3 Multi-sig)</h2>
          <p className="text-sm text-gray-400">
            Choose 3 trusted verifiers who will approve claims. 2 of 3 must approve.
          </p>
          <Input label="Verifier 1" placeholder="0x..." value={verifier1} onChange={(e) => setVerifier1(e.target.value)} />
          <Input label="Verifier 2" placeholder="0x..." value={verifier2} onChange={(e) => setVerifier2(e.target.value)} />
          <Input label="Verifier 3" placeholder="0x..." value={verifier3} onChange={(e) => setVerifier3(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => {
              if (!isAddress(verifier1) || !isAddress(verifier2) || !isAddress(verifier3)) {
                toast.error("All verifier addresses must be valid Ethereum addresses");
                return;
              }
              setStep(2);
            }} disabled={!verifier1 || !verifier2 || !verifier3}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
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
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={heirs.length === 0}>Next</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gold">Review & Fund</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Plan:</span> {planName}</p>
            <p><span className="text-gray-400">Inactivity:</span> {inactivityDays} days</p>
            <p><span className="text-gray-400">Verifiers:</span></p>
            <ul className="list-disc list-inside text-gray-400 font-mono text-xs">
              <li>{verifier1}</li>
              <li>{verifier2}</li>
              <li>{verifier3}</li>
            </ul>
            <p><span className="text-gray-400">Heirs:</span> {heirs.length}</p>
            <p><span className="text-gray-400">Total Share:</span> {(totalShares / 100).toFixed(2)}%</p>
          </div>
          <Input
            label="Initial Funding (ETH)"
            type="number"
            step="0.01"
            min="0"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleSubmit} loading={loading}>
              Create Plan & Fund
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
