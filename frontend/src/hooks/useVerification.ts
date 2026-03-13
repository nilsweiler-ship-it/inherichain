import { useReadContract, useWriteContract } from "wagmi";
import { useState } from "react";
import planAbi from "../abi/InheritancePlan.json";
import poolAbi from "../abi/FallbackVerifierPool.json";
import type { FallbackVerifier } from "../types";

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

  async function stakeAsVerifier(planAddress: `0x${string}`, bondAmount: bigint) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "stakeAsVerifier",
        value: bondAmount,
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function withdrawVerifierBond(planAddress: `0x${string}`) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "withdrawVerifierBond",
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function raiseChallenge(planAddress: `0x${string}`, claimId: number, challengeStake: bigint) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "raiseChallenge",
        args: [BigInt(claimId)],
        value: challengeStake,
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function resolveChallenge(planAddress: `0x${string}`, challengeId: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "resolveChallenge",
        args: [BigInt(challengeId)],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function finalizeChallenge(planAddress: `0x${string}`, challengeId: number) {
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: planAddress,
        abi: planAbi,
        functionName: "finalizeChallenge",
        args: [BigInt(challengeId)],
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    vote,
    stakeAsVerifier,
    withdrawVerifierBond,
    raiseChallenge,
    resolveChallenge,
    finalizeChallenge,
    loading,
  };
}

export function useFallbackPool(poolAddress: `0x${string}` | undefined) {
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);

  const { data: poolSize } = useReadContract({
    address: poolAddress,
    abi: poolAbi,
    functionName: "getPoolSize",
    query: { enabled: !!poolAddress },
  });

  const { data: activeCount } = useReadContract({
    address: poolAddress,
    abi: poolAbi,
    functionName: "getActiveVerifierCount",
    query: { enabled: !!poolAddress },
  });

  async function registerAsFallbackVerifier(stakeAmount: bigint) {
    if (!poolAddress) throw new Error("Pool address not set");
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: poolAbi,
        functionName: "registerAsFallbackVerifier",
        value: stakeAmount,
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function withdrawFromPool() {
    if (!poolAddress) throw new Error("Pool address not set");
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: poolAbi,
        functionName: "withdrawFromPool",
      });
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const { config } = await import("../config/wagmi");
      await waitForTransactionReceipt(config, { hash });
      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    poolSize: poolSize as bigint | undefined,
    activeCount: activeCount as bigint | undefined,
    registerAsFallbackVerifier,
    withdrawFromPool,
    loading,
  };
}

export function useFallbackVerifierInfo(poolAddress: `0x${string}` | undefined, verifierAddress: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: poolAddress,
    abi: poolAbi,
    functionName: "getVerifierInfo",
    args: verifierAddress ? [verifierAddress] : undefined,
    query: { enabled: !!poolAddress && !!verifierAddress },
  });

  return {
    verifierInfo: data as FallbackVerifier | undefined,
    isLoading,
    refetch,
  };
}

export function useIsRegisteredFallback(poolAddress: `0x${string}` | undefined, verifierAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: poolAddress,
    abi: poolAbi,
    functionName: "isRegistered",
    args: verifierAddress ? [verifierAddress] : undefined,
    query: { enabled: !!poolAddress && !!verifierAddress },
  });
}
