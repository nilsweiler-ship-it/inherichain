import { formatEther } from "viem";
import { BASIS_POINTS } from "./constants";

export function formatBasisPoints(bp: bigint | number): string {
  const val = typeof bp === "bigint" ? Number(bp) : bp;
  return `${(val / (BASIS_POINTS / 100)).toFixed(2)}%`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatEth(wei: bigint): string {
  return `${parseFloat(formatEther(wei)).toFixed(4)} ETH`;
}

export function formatTimeRemaining(seconds: bigint | number): string {
  const secs = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (secs <= 0) return "Inactive";
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((secs % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function ipfsUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
