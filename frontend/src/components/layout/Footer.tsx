import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between text-gray-500 text-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold" />
          <span>InheriChain</span>
        </div>
        <p>Decentralized Digital Inheritance on Ethereum</p>
      </div>
    </footer>
  );
}
