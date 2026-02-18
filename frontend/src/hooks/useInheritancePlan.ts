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
    const d = data as [string, string, [string, string, string], bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    planDetails = {
      address: planAddress,
      owner: d[0] as `0x${string}`,
      planName: d[1],
      verifiers: d[2] as [`0x${string}`, `0x${string}`, `0x${string}`],
      inactivityPeriod: d[3],
      lastCheckIn: d[4],
      balance: d[5],
      heirCount: d[6],
      claimCount: d[7],
      totalShareAllocated: d[8],
      isInactive: d[9],
    };
  }

  return { planDetails, isLoading, refetch };
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

  return { addHeirToPlan, registerHeirOnFactory };
}
