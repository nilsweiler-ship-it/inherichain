import { useAccount } from "wagmi";
import { useOwnerPlans } from "../hooks/useFactory";
import { useCheckIn } from "../hooks/useCheckIn";
import { PlanCard } from "../components/plan/PlanCard";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { Link } from "react-router";
import toast from "react-hot-toast";
import type { PlanDetails } from "../types";
import { useState, useEffect, useCallback } from "react";
import planAbi from "../abi/InheritancePlan.json";
import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";

export function OwnerDashboard() {
  const { address, isConnected } = useAccount();
  const { data: planAddresses, isLoading } = useOwnerPlans(address);
  const { checkIn, loading: checkInLoading } = useCheckIn();
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [fetchVersion, setFetchVersion] = useState(0);

  const fetchPlans = useCallback(async () => {
    if (!planAddresses || (planAddresses as `0x${string}`[]).length === 0) {
      setPlans([]);
      return;
    }
    setLoadingPlans(true);
    const results: PlanDetails[] = [];
    for (const addr of planAddresses as `0x${string}`[]) {
      try {
        const data = await readContract(config, {
          address: addr,
          abi: planAbi,
          functionName: "getPlanDetails",
        }) as [string, string, [string, string, string], bigint, bigint, bigint, bigint, bigint, bigint, boolean];
        results.push({
          address: addr,
          owner: data[0] as `0x${string}`,
          planName: data[1],
          verifiers: data[2] as [`0x${string}`, `0x${string}`, `0x${string}`],
          inactivityPeriod: data[3],
          lastCheckIn: data[4],
          balance: data[5],
          heirCount: data[6],
          claimCount: data[7],
          totalShareAllocated: data[8],
          isInactive: data[9],
        });
      } catch (err) {
        console.error(`Failed to fetch plan ${addr}:`, err);
        toast.error("Failed to load a plan");
      }
    }
    setPlans(results);
    setLoadingPlans(false);
  }, [planAddresses]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, fetchVersion]);

  async function handleCheckIn(planAddress: `0x${string}`) {
    try {
      await checkIn(planAddress);
      toast.success("Checked in successfully!");
      setFetchVersion((v) => v + 1);
    } catch (err) {
      console.error("Check-in failed:", err);
      toast.error("Check-in failed");
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">Connect your wallet to view your plans.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gold">Owner Dashboard</h1>
        <Link to="/create">
          <Button>Create New Plan</Button>
        </Link>
      </div>

      {(isLoading || loadingPlans) ? (
        <Spinner />
      ) : plans.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="text-gray-400 text-lg">No plans yet.</p>
          <Link to="/create"><Button>Create Your First Plan</Button></Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.address} className="space-y-2">
              <PlanCard plan={plan} />
              {!plan.isInactive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCheckIn(plan.address)}
                  loading={checkInLoading}
                  className="w-full"
                >
                  Check In
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
