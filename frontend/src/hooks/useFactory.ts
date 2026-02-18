import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import factoryAbi from "../abi/InheriChainFactory.json";
import { FACTORY_ADDRESS } from "../utils/constants";

export function useFactory() {
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  async function createPlan(
    planName: string,
    verifiers: [`0x${string}`, `0x${string}`, `0x${string}`],
    inactivityPeriod: bigint
  ): Promise<`0x${string}` | null> {
    const hash = await writeContractAsync({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "createPlan",
      args: [planName, verifiers, inactivityPeriod],
    });
    setTxHash(hash);

    const { waitForTransactionReceipt } = await import("@wagmi/core");
    const { config } = await import("../config/wagmi");
    const receipt = await waitForTransactionReceipt(config, { hash });

    // Parse PlanCreated event to get plan address
    const iface = await import("viem");
    const log = receipt.logs.find((l) => {
      try {
        const decoded = iface.decodeEventLog({
          abi: factoryAbi,
          data: l.data,
          topics: l.topics,
        });
        return decoded.eventName === "PlanCreated";
      } catch {
        return false;
      }
    });

    if (log) {
      const decoded = iface.decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics,
      });
      return (decoded.args as unknown as { plan: `0x${string}` }).plan;
    }
    return null;
  }

  return { createPlan, isConfirming };
}

export function useOwnerPlans(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "getOwnerPlans",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });
}

export function useHeirPlans(heir: `0x${string}` | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "getHeirPlans",
    args: heir ? [heir] : undefined,
    query: { enabled: !!heir },
  });
}

export function useVerifierPlans(verifier: `0x${string}` | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "getVerifierPlans",
    args: verifier ? [verifier] : undefined,
    query: { enabled: !!verifier },
  });
}
