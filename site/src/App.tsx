import {
  Shield,
  Scale,
  Clock,
  DollarSign,
  Globe,
  Lock,
  Users,
  FileCheck,
  Zap,
  Eye,
  Ban,
  Check,
  X,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const comparisonRows = [
  {
    feature: "Custody of Assets",
    traditional: "Held by banks, attorneys, or courts",
    inherichain: "Self-custodied in your own smart contract",
    advantage: "inherichain",
  },
  {
    feature: "Time to Distribute",
    traditional: "6 months to 3+ years (probate)",
    inherichain: "Minutes after verification",
    advantage: "inherichain",
  },
  {
    feature: "Cost",
    traditional: "3-7% of estate (legal fees, court costs, executor fees)",
    inherichain: "Only gas fees (< $5 on L2s)",
    advantage: "inherichain",
  },
  {
    feature: "Transparency",
    traditional: "Opaque process, heirs often left in the dark",
    inherichain: "Fully auditable on-chain, real-time status",
    advantage: "inherichain",
  },
  {
    feature: "Geographic Limits",
    traditional: "Jurisdiction-bound, cross-border is complex",
    inherichain: "Borderless, works anywhere with internet",
    advantage: "inherichain",
  },
  {
    feature: "Middlemen Required",
    traditional: "Lawyers, courts, banks, executors",
    inherichain: "None — just owner, heirs, and 3 verifiers",
    advantage: "inherichain",
  },
  {
    feature: "Privacy",
    traditional: "Probate records are public in many jurisdictions",
    inherichain: "Pseudonymous wallet addresses",
    advantage: "inherichain",
  },
  {
    feature: "Modification",
    traditional: "Requires new legal documents, notarization",
    inherichain: "Owner updates heirs/shares with one transaction",
    advantage: "inherichain",
  },
  {
    feature: "Fraud Protection",
    traditional: "Relies on legal system enforcement",
    inherichain: "Immutable code, 2-of-3 multi-sig verification",
    advantage: "inherichain",
  },
  {
    feature: "Asset Types",
    traditional: "Physical, financial, and digital assets",
    inherichain: "Crypto assets (ETH, tokens)",
    advantage: "traditional",
  },
  {
    feature: "Legal Recognition",
    traditional: "Fully recognized by courts worldwide",
    inherichain: "Emerging legal landscape, not yet universally recognized",
    advantage: "traditional",
  },
  {
    feature: "Dispute Resolution",
    traditional: "Court-mediated resolution process",
    inherichain: "Limited to on-chain verifier consensus",
    advantage: "traditional",
  },
];

const usps = [
  {
    icon: Lock,
    title: "Zero Custody Risk",
    description:
      "Your assets never leave your control. Each inheritance plan is an isolated smart contract that only you can withdraw from while active. No bank, no exchange, no attorney holds your funds.",
  },
  {
    icon: Clock,
    title: "Automated Inactivity Detection",
    description:
      "Configure a check-in period (30+ days). If you stop checking in, your plan automatically activates — no death certificate processing delays, no probate court waiting periods.",
  },
  {
    icon: Users,
    title: "Decentralized 2-of-3 Verification",
    description:
      "Choose 3 trusted verifiers. Any 2 must approve a claim before funds release. No single point of failure, no single party can block or steal inheritance.",
  },
  {
    icon: DollarSign,
    title: "Near-Zero Cost",
    description:
      "Traditional inheritance costs 3-7% of the estate in legal and administrative fees. InheriChain costs only blockchain gas fees — typically under $5 per transaction.",
  },
  {
    icon: Zap,
    title: "Instant Distribution",
    description:
      "Once 2 of 3 verifiers approve, heirs can claim their share immediately. No months of probate, no court dates, no bureaucratic delays.",
  },
  {
    icon: Globe,
    title: "Borderless by Default",
    description:
      "Works across any country, any timezone. Your heir in Tokyo can claim from a plan created in New York. No cross-border legal complexity.",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    description:
      "Every action is recorded on-chain. Heirs can verify their share, plan balance, and status at any time. No hidden fees, no surprises.",
  },
  {
    icon: FileCheck,
    title: "Cryptographic Proof",
    description:
      "Supporting documents are stored on IPFS — tamper-proof and permanently available. Verifiers review real evidence, not just claims.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Owner Creates Plan",
    description:
      "Deploy your own inheritance contract. Set check-in period, add 3 trusted verifiers, define heirs with percentage shares, and fund it with ETH.",
  },
  {
    step: "02",
    title: "Owner Checks In",
    description:
      "Periodically confirm you're active. As long as you check in within your configured period, the plan stays locked and you retain full control.",
  },
  {
    step: "03",
    title: "Inactivity Triggers Activation",
    description:
      "If check-ins stop, the plan becomes claimable. Heirs can now submit claims with supporting documentation uploaded to IPFS.",
  },
  {
    step: "04",
    title: "Verifiers Review & Vote",
    description:
      "Your 3 chosen verifiers review the claim and documents. 2-of-3 must approve. This prevents fraudulent claims while avoiding single points of failure.",
  },
  {
    step: "05",
    title: "Heirs Claim Their Share",
    description:
      "Once approved, each heir withdraws their proportional share directly to their wallet. No intermediary touches the funds at any point.",
  },
];

const faqs = [
  {
    q: "What happens if I lose access to my wallet?",
    a: "If you can't check in within your inactivity period, the plan activates naturally — which is the intended inheritance mechanism. Your heirs can then claim. For wallet recovery, we recommend using a hardware wallet with a secure seed phrase backup.",
  },
  {
    q: "Can I change my heirs after creating a plan?",
    a: "Yes. As the owner, you can add or remove heirs and adjust share percentages at any time, as long as you're still active (checking in regularly).",
  },
  {
    q: "What if a verifier becomes unavailable?",
    a: "Only 2 of 3 verifiers need to approve, so one unavailable verifier doesn't block the process. For the MVP, verifiers are fixed at plan creation. Choose reliable, long-term trusted contacts.",
  },
  {
    q: "Is this legally binding?",
    a: "InheriChain operates as a smart contract on Ethereum. While the code executes deterministically, legal recognition of on-chain inheritance varies by jurisdiction. We recommend consulting a legal professional for your specific situation.",
  },
  {
    q: "What assets can I include?",
    a: "Currently, InheriChain supports ETH. ERC-20 token support and NFT inheritance are on the roadmap.",
  },
  {
    q: "How much does it cost?",
    a: "Only Ethereum gas fees for each transaction (creating a plan, adding heirs, check-ins, voting, claiming). No platform fees, no percentage-based charges, no subscriptions.",
  },
];

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-dark/90 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-gold" />
          <span className="text-xl font-bold text-gold tracking-tight">InheriChain</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#comparison" className="hover:text-gold transition-colors">Comparison</a>
          <a href="#usps" className="hover:text-gold transition-colors">Why InheriChain</a>
          <a href="#how-it-works" className="hover:text-gold transition-colors">How It Works</a>
          <a href="#faq" className="hover:text-gold transition-colors">FAQ</a>
        </div>
        <a
          href="http://localhost:5173"
          className="bg-gold text-navy-dark px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gold-light transition-colors"
        >
          Launch App
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-gold)_0%,_transparent_50%)] opacity-5" />
      <div className="max-w-4xl mx-auto relative">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 text-gold text-sm mb-8">
          <Scale className="w-4 h-4" />
          Traditional Inheritance is Broken
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          Your Crypto Deserves a{" "}
          <span className="text-gold">Better Legacy Plan</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Traditional inheritance takes years, costs thousands, and requires trusting
          middlemen. InheriChain replaces all of that with a single smart contract.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#comparison"
            className="inline-flex items-center justify-center gap-2 bg-gold text-navy-dark px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-gold-light transition-colors"
          >
            See the Comparison <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 border border-gray-600 text-gray-300 px-8 py-3.5 rounded-xl font-bold text-lg hover:border-gold hover:text-gold transition-colors"
          >
            How It Works <ChevronDown className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ProblemStatement() {
  const problems = [
    { icon: Clock, stat: "18 months", label: "Average probate duration in the US" },
    { icon: DollarSign, stat: "3-7%", label: "Typical legal & administrative fees" },
    { icon: Ban, stat: "$68B", label: "Estimated crypto locked in inaccessible wallets" },
    { icon: Scale, stat: "70%", label: "Of adults don't have a will" },
  ];

  return (
    <section className="py-16 px-6 border-y border-gray-800 bg-navy-dark/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          The Inheritance <span className="text-red-soft">Problem</span>
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Billions in crypto are at risk of being lost forever. Traditional systems weren't
          built for digital assets.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {problems.map((p) => (
            <div key={p.label} className="text-center">
              <p.icon className="w-8 h-8 text-red-soft mx-auto mb-3" />
              <p className="text-3xl font-bold text-white mb-1">{p.stat}</p>
              <p className="text-sm text-gray-500">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  return (
    <section id="comparison" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Side-by-Side <span className="text-gold">Comparison</span>
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          See how InheriChain stacks up against traditional wills, trusts, and probate.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-dark border-b border-gray-700">
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Feature</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">
                  <span className="flex items-center gap-2">
                    <Scale className="w-4 h-4" /> Traditional
                  </span>
                </th>
                <th className="text-left px-6 py-4 text-gold font-medium">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> InheriChain
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={clsx(
                    "border-b border-gray-800 hover:bg-white/[0.02] transition-colors",
                    i % 2 === 0 ? "bg-navy-light/30" : ""
                  )}
                >
                  <td className="px-6 py-4 font-medium text-white">{row.feature}</td>
                  <td className="px-6 py-4 text-gray-400">
                    <span className="flex items-start gap-2">
                      {row.advantage === "traditional" ? (
                        <Check className="w-4 h-4 text-green-soft mt-0.5 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-red-soft mt-0.5 shrink-0" />
                      )}
                      {row.traditional}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    <span className="flex items-start gap-2">
                      {row.advantage === "inherichain" ? (
                        <Check className="w-4 h-4 text-green-soft mt-0.5 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-red-soft mt-0.5 shrink-0" />
                      )}
                      {row.inherichain}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-gray-500 text-sm mt-6">
          InheriChain excels at digital asset inheritance. Traditional methods still hold
          advantages for physical assets and legal disputes.
        </p>
      </div>
    </section>
  );
}

function USPs() {
  return (
    <section id="usps" className="py-20 px-6 bg-navy-dark/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Why <span className="text-gold">InheriChain</span>?
        </h2>
        <p className="text-gray-400 text-center mb-14 max-w-2xl mx-auto">
          Eight unique advantages that make decentralized inheritance the future.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {usps.map((usp) => (
            <div
              key={usp.title}
              className="bg-navy-light border border-gray-700 rounded-xl p-6 hover:border-gold/40 transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <usp.icon className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-lg font-bold mb-2">{usp.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{usp.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          How It <span className="text-gold">Works</span>
        </h2>
        <p className="text-gray-400 text-center mb-14 max-w-2xl mx-auto">
          Five simple steps from plan creation to fund distribution.
        </p>
        <div className="space-y-8">
          {howItWorks.map((step, i) => (
            <div key={step.step} className="flex gap-6 items-start group">
              <div className="relative">
                <div className="w-14 h-14 bg-navy-light border-2 border-gold/40 rounded-xl flex items-center justify-center font-bold text-gold text-lg group-hover:border-gold group-hover:bg-gold/10 transition-all">
                  {step.step}
                </div>
                {i < howItWorks.length - 1 && (
                  <div className="absolute top-14 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-700" />
                )}
              </div>
              <div className="pt-1">
                <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="py-20 px-6 bg-navy-dark/50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
          Frequently Asked <span className="text-gold">Questions</span>
        </h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group bg-navy-light border border-gray-700 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-white font-medium hover:text-gold transition-colors list-none">
                {faq.q}
                <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-6 pb-4 text-gray-400 text-sm leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <Shield className="w-14 h-14 text-gold mx-auto mb-6" />
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Secure Your Crypto Legacy <span className="text-gold">Today</span>
        </h2>
        <p className="text-gray-400 text-lg mb-8">
          Don't let your digital assets become inaccessible. Create your first
          inheritance plan in under 5 minutes.
        </p>
        <a
          href="http://localhost:5173"
          className="inline-flex items-center gap-2 bg-gold text-navy-dark px-10 py-4 rounded-xl font-bold text-lg hover:bg-gold-light transition-colors"
        >
          Launch InheriChain <ArrowRight className="w-5 h-5" />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between text-gray-500 text-sm gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold" />
          <span>InheriChain</span>
        </div>
        <p>Decentralized digital inheritance on Ethereum. Built on Sepolia testnet.</p>
        <a
          href="https://github.com/nilsweiler-ship-it/inherichain"
          className="hover:text-gold transition-colors"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  return (
    <>
      <Nav />
      <Hero />
      <ProblemStatement />
      <ComparisonTable />
      <USPs />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}

export default App;
