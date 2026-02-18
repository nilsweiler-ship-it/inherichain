import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router";
import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-navy-dark/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <Shield className="w-8 h-8 text-gold" />
          <span className="text-xl font-bold text-gold">InheriChain</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/dashboard/owner" className="text-gray-300 hover:text-gold transition-colors no-underline">
            Owner
          </Link>
          <Link to="/dashboard/heir" className="text-gray-300 hover:text-gold transition-colors no-underline">
            Heir
          </Link>
          <Link to="/dashboard/verifier" className="text-gray-300 hover:text-gold transition-colors no-underline">
            Verifier
          </Link>
          <Link to="/create" className="text-gray-300 hover:text-gold transition-colors no-underline">
            Create Plan
          </Link>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
