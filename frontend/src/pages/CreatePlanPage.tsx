import { useState } from "react";
import { useAccount } from "wagmi";
import { CreatePlanForm } from "../components/plan/CreatePlanForm";
import { Card } from "../components/ui/Card";
import { LegalDisclaimer } from "../components/ui/LegalDisclaimer";

export function CreatePlanPage() {
  const { isConnected } = useAccount();
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-8 text-center">Create Inheritance Plan</h1>
      {!isConnected ? (
        <Card className="text-center py-12">
          <p className="text-gray-400 text-lg">Connect your wallet to create a plan.</p>
        </Card>
      ) : !disclaimerAccepted ? (
        <LegalDisclaimer onAccept={() => setDisclaimerAccepted(true)} />
      ) : (
        <CreatePlanForm />
      )}
    </div>
  );
}
