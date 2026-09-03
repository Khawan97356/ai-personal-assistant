import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import IntegrationsSection from "@/components/IntegrationsSection";
import FeatureList from "@/components/FeatureList";
import BentoGrid from "@/components/BentoGrid";
import InteractiveSimulator from "@/components/InteractiveSimulator";
import MetricsAndTestimonials from "@/components/MetricsAndTestimonials";
import PricingSection from "@/components/PricingSection";
import FaqSection from "@/components/FaqSection";
import CtaBanner from "@/components/CtaBanner";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#08090e] text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navigation Header */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero />

        {/* Connected Ecosystems / Integrations */}
        <IntegrationsSection />

        {/* Core Feature List */}
        <FeatureList />

        {/* Premium Bento Grid */}
        <BentoGrid />

        {/* Live Interactive Agent Simulation */}
        <InteractiveSimulator />

        {/* Metrics & Social Proof */}
        <MetricsAndTestimonials />

        {/* Transparent Pricing */}
        <PricingSection />

        {/* Questions & Answers */}
        <FaqSection />

        {/* High Impact Call-to-Action */}
        <CtaBanner />
      </main>

      {/* Modern Footer */}
      <Footer />
    </div>
  );
}
