import { Routes, Route } from "react-router";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { LandingPage } from "./pages/LandingPage";
import { CreatePlanPage } from "./pages/CreatePlanPage";
import { OwnerDashboard } from "./pages/OwnerDashboard";
import { HeirDashboard } from "./pages/HeirDashboard";
import { VerifierPanel } from "./pages/VerifierPanel";
import { PlanDetailPage } from "./pages/PlanDetailPage";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreatePlanPage />} />
          <Route path="/dashboard/owner" element={<OwnerDashboard />} />
          <Route path="/dashboard/heir" element={<HeirDashboard />} />
          <Route path="/dashboard/verifier" element={<VerifierPanel />} />
          <Route path="/plan/:address" element={<PlanDetailPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
