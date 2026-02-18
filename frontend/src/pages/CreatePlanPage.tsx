import { useAccount } from "wagmi";
import { CreatePlanForm } from "../components/plan/CreatePlanForm";
import { Card } from "../components/ui/Card";

export function CreatePlanPage() {
  const { isConnected } = useAccount();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-8 text-center">Create Inheritance Plan</h1>
      {isConnected ? (
        <CreatePlanForm />
      ) : (
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">Connect your wallet to create a plan.</p>
        </Card>
      )}
    </div>
  );
}
