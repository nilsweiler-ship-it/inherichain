import { Link } from "react-router";
import { Shield, Lock, Users, Clock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const features = [
  {
    icon: Lock,
    title: "Self-Custody",
    description: "Assets stay in your contract. No middlemen, no centralized custody.",
  },
  {
    icon: Users,
    title: "2-of-3 Verification",
    description: "Trusted verifiers approve claims with multi-signature security.",
  },
  {
    icon: Clock,
    title: "Inactivity Detection",
    description: "Automatic triggering based on configurable check-in periods.",
  },
  {
    icon: Shield,
    title: "Isolated Plans",
    description: "Each plan is a separate contract with its own balance and rules.",
  },
];

const steps = [
  { num: "01", title: "Create Plan", desc: "Set up your inheritance plan with heirs, verifiers, and conditions." },
  { num: "02", title: "Fund & Check In", desc: "Deposit ETH and check in periodically to stay active." },
  { num: "03", title: "Claim & Verify", desc: "Heirs submit claims with documents. Verifiers review and approve." },
  { num: "04", title: "Distribute", desc: "Approved heirs withdraw their share proportionally." },
];

export function LandingPage() {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero */}
      <section className="text-center py-20 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Shield className="w-16 h-16 text-gold mx-auto" />
          <h1 className="text-5xl font-bold">
            Decentralized Digital <span className="text-gold">Inheritance</span>
          </h1>
          <p className="text-xl text-gray-400">
            Protect your crypto legacy. Set up inheritance plans that distribute assets
            to your heirs when verifiable conditions are met. No middlemen required.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/create">
              <Button size="lg">Create a Plan</Button>
            </Link>
            <Link to="/dashboard/heir">
              <Button variant="secondary" size="lg">View as Heir</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why <span className="text-gold">InheriChain</span>?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="text-center space-y-3">
              <f.icon className="w-10 h-10 text-gold mx-auto" />
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-6 items-start">
              <span className="text-4xl font-bold text-gold/30">{s.num}</span>
              <div>
                <h3 className="text-xl font-bold text-gold">{s.title}</h3>
                <p className="text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
