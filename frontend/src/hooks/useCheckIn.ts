import { useWriteContract } from "wagmi";
import { useState } from "react";
import planAbi from "../abi/InheritancePlan.json";

export function useCheckIn() {
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);

  async function checkIn(planAddress: `0x${string}`) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "checkIn",
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  return { checkIn, loading };
}
