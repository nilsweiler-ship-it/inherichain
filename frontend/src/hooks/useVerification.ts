import { useWriteContract } from "wagmi";
import { useState } from "react";
import planAbi from "../abi/InheritancePlan.json";

export function useVerification() {
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);

  async function vote(planAddress: `0x${string}`, claimId: number, approve: boolean) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "vote",
        args: [BigInt(claimId), approve],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  return { vote, loading };
}
