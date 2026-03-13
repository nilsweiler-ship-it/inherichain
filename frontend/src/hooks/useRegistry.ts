import { useReadContract } from "wagmi";
import registryAbi from "../abi/VerifierRegistry.json";
import type { VerifierStats } from "../types";

export function useVerifierStats(registryAddress: `0x${string}` | undefined, verifier: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getStats",
    args: verifier ? [verifier] : undefined,
    query: { enabled: !!registryAddress && !!verifier },
  });

  return { stats: data as VerifierStats | undefined, isLoading, refetch };
}

export function useVerifierReputation(registryAddress: `0x${string}` | undefined, verifier: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getReputation",
    args: verifier ? [verifier] : undefined,
    query: { enabled: !!registryAddress && !!verifier },
  });

  return { reputation: data as bigint | undefined, isLoading };
}
