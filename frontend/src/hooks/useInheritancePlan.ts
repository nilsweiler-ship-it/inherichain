import { useReadContract, useWriteContract } from "wagmi";
import planAbi from "../abi/InheritancePlan.json";
import factoryAbi from "../abi/InheriChainFactory.json";
import { FACTORY_ADDRESS } from "../utils/constants";
import type { PlanDetails, Heir } from "../types";

export function usePlanDetails(planAddress: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "getPlanDetails",
    query: { enabled: !!planAddress },
  });

  let planDetails: PlanDetails | undefined;
  if (data && planAddress) {
    const d = data as [
      string, string, string[], bigint, bigint, bigint, bigint, bigint, bigint, boolean,
      {
        requiredApprovals: bigint; totalVerifiers: bigint; verifierBond: bigint;
        challengePeriod: bigint; challengeStake: bigint; gracePeriod: bigint;
        recoveryAddress: string; phase2Delay: bigint; phase3Delay: bigint; autoRelease: boolean;
      },
      boolean, boolean
    ];
    planDetails = {
      address: planAddress,
      owner: d[0] as `0x${string}`,
      planName: d[1],
      verifiers: d[2] as `0x${string}`[],
      inactivityPeriod: d[3],
      lastCheckIn: d[4],
      balance: d[5],
      heirCount: d[6],
      claimCount: d[7],
      totalShareAllocated: d[8],
      isInactive: d[9],
      config: {
        requiredApprovals: d[10].requiredApprovals,
        totalVerifiers: d[10].totalVerifiers,
        verifierBond: d[10].verifierBond,
        challengePeriod: d[10].challengePeriod,
        challengeStake: d[10].challengeStake,
        gracePeriod: d[10].gracePeriod,
        recoveryAddress: d[10].recoveryAddress as `0x${string}`,
        phase2Delay: d[10].phase2Delay,
        phase3Delay: d[10].phase3Delay,
        autoRelease: d[10].autoRelease,
      },
      gracePeriodActive: d[11],
      recoveryExtensionUsed: d[12],
    };
  }

  return { planDetails, isLoading, refetch };
}

export function useHeirAccepted(planAddress: `0x${string}` | undefined, heirAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "heirAccepted",
    args: heirAddress ? [heirAddress] : undefined,
    query: { enabled: !!planAddress && !!heirAddress },
  });
}

export function usePlanHeirs(planAddress: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "getAllHeirs",
    query: { enabled: !!planAddress },
  });

  return {
    heirs: (data as Heir[] | undefined) ?? [],
    isLoading,
    refetch,
  };
}

export function useTimeUntilInactive(planAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "timeUntilInactive",
    query: { enabled: !!planAddress, refetchInterval: 30000 },
  });
}

export function useInheritancePlan() {
  const { writeContractAsync } = useWriteContract();

  async function addHeirToPlan(
    planAddress: `0x${string}`,
    wallet: `0x${string}`,
    sharePercentage: bigint,
    condition: number,
    ageThreshold: bigint,
    conditionDetail: string
  ) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "addHeir",
      args: [wallet, sharePercentage, condition, ageThreshold, conditionDetail],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function registerHeirOnFactory(planAddress: `0x${string}`, heir: `0x${string}`) {
    const hash = await writeContractAsync({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "registerHeir",
      args: [planAddress, heir],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function extendCheckIn(planAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "extendCheckIn",
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function removeHeir(planAddress: `0x${string}`, wallet: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "removeHeir",
      args: [wallet],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function updateHeirShare(planAddress: `0x${string}`, wallet: `0x${string}`, newShare: bigint) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "updateHeirShare",
      args: [wallet, newShare],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function updateHeirCondition(
    planAddress: `0x${string}`,
    wallet: `0x${string}`,
    condition: number,
    ageThreshold: bigint,
    conditionDetail: string
  ) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "updateHeirCondition",
      args: [wallet, condition, ageThreshold, conditionDetail],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function updateInactivityPeriod(planAddress: `0x${string}`, newPeriod: bigint) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "updateInactivityPeriod",
      args: [newPeriod],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function revokePlan(planAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "revokePlan",
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function acceptInheritance(planAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "acceptInheritance",
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function updateDistributionDelays(planAddress: `0x${string}`, phase2Delay: bigint, phase3Delay: bigint) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "updateDistributionDelays",
      args: [phase2Delay, phase3Delay],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function addChallenger(planAddress: `0x${string}`, challenger: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "addChallenger",
      args: [challenger],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function removeChallenger(planAddress: `0x${string}`, challenger: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "removeChallenger",
      args: [challenger],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function setBackupHeir(planAddress: `0x${string}`, backupHeirAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "setBackupHeir",
      args: [backupHeirAddress],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function activateBackupHeir(planAddress: `0x${string}`, originalHeir: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "activateBackupHeir",
      args: [originalHeir],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function cancelDistribution(planAddress: `0x${string}`, claimId: number) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "cancelDistribution",
      args: [BigInt(claimId)],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function setOracle(planAddress: `0x${string}`, oracleAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "setOracle",
      args: [oracleAddress],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  async function setFallbackPool(planAddress: `0x${string}`, poolAddress: `0x${string}`) {
    const hash = await writeContractAsync({
      address: planAddress,
      abi: planAbi,
      functionName: "setFallbackPool",
      args: [poolAddress],
    });
    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    await waitForTransactionReceipt(config, { hash });
  }

  return {
    addHeirToPlan,
    registerHeirOnFactory,
    extendCheckIn,
    removeHeir,
    updateHeirShare,
    updateHeirCondition,
    updateInactivityPeriod,
    revokePlan,
    acceptInheritance,
    updateDistributionDelays,
    addChallenger,
    removeChallenger,
    setBackupHeir,
    activateBackupHeir,
    cancelDistribution,
    setOracle,
    setFallbackPool,
  };
}
