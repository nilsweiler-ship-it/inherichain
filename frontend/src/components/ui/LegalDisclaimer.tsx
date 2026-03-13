import { useState } from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface Props {
  onAccept: () => void;
}

export function LegalDisclaimer({ onAccept }: Props) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Card className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gold">Legal Disclaimer</h2>
      <div className="text-sm text-gray-300 space-y-3 max-h-64 overflow-y-auto">
        <p>
          <strong>Important Notice:</strong> InheriChain is a decentralized application running on the Ethereum blockchain.
          By using this platform, you acknowledge and agree to the following:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>
            Smart contracts are immutable once deployed. While audited for correctness, they may contain bugs or
            vulnerabilities. Use at your own risk.
          </li>
          <li>
            InheriChain does not constitute legal advice and is not a substitute for proper estate planning
            with a qualified legal professional in your jurisdiction.
          </li>
          <li>
            Digital asset inheritance is subject to the laws and regulations of your jurisdiction. It is your
            responsibility to ensure compliance with local laws.
          </li>
          <li>
            Documents uploaded to IPFS are encrypted, but no encryption is guaranteed to be unbreakable.
            Do not rely solely on this platform for sensitive estate documents.
          </li>
          <li>
            The platform depends on verifiers acting honestly. While economic incentives (bonds, slashing) exist
            to align behavior, no guarantee of honest verification is made.
          </li>
          <li>
            Transaction fees (gas) are required for all on-chain operations and are non-refundable.
          </li>
          <li>
            This is a testnet/MVP deployment. Do not use this for real asset management until a production
            audit has been completed.
          </li>
        </ul>
      </div>
      <div className="flex items-center gap-3 border-t border-gray-700 pt-3">
        <input
          type="checkbox"
          id="legal-accept"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="legal-accept" className="text-sm text-gray-300">
          I have read and understand the above disclaimer
        </label>
      </div>
      <Button onClick={onAccept} disabled={!accepted}>
        Continue to Create Plan
      </Button>
    </Card>
  );
}
