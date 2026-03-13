import { useReadContract, useWriteContract } from "wagmi";
import { useState } from "react";
import planAbi from "../abi/InheritancePlan.json";
import type { Claim, OracleResult } from "../types";

export function useClaimInfo(planAddress: `0x${string}` | undefined, claimId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "getClaimInfo",
    args: [BigInt(claimId)],
    query: { enabled: !!planAddress },
  });

  return { claim: data as Claim | undefined, isLoading, refetch };
}

export function useClaimCount(planAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "getClaimCount",
    query: { enabled: !!planAddress },
  });
}

export function useClaims() {
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);

  async function submitClaim(planAddress: `0x${string}`, documentCID: string) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "submitClaim",
        args: [documentCID],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function distributePhase(planAddress: `0x${string}`, claimId: number, phase: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "distributePhase",
        args: [BigInt(claimId), phase],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function finalizeApproval(planAddress: `0x${string}`, claimId: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "finalizeApproval",
        args: [BigInt(claimId)],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function cancelClaimAsOwner(planAddress: `0x${string}`, claimId: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "cancelClaimAsOwner",
        args: [BigInt(claimId)],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function triggerFallbackVerification(planAddress: `0x${string}`, claimId: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "triggerFallbackVerification",
        args: [BigInt(claimId)],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  return { submitClaim, distributePhase, finalizeApproval, cancelClaimAsOwner, triggerFallbackVerification, loading };
}

export function useOracleValidated(planAddress: `0x${string}` | undefined, claimId: number) {
  return useReadContract({
    address: planAddress,
    abi: planAbi,
    functionName: "claimOracleValidated",
    args: [BigInt(claimId)],
    query: { enabled: !!planAddress },
  });
}
