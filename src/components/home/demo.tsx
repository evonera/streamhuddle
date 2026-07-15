import Navbar from './navbar';
import Hero from './hero';
import Footer from './footer';
import Features from './features';
import { PricingTableOne } from '@/components/billingsdk/pricing-table-one';
import { plans } from '@/lib/billingsdk-config';
import Container from './container';
import { useNavigate } from '@tanstack/react-router';

export default function Landing01Demo() {
    const navigate = useNavigate();
    return (
        <main className="dark min-h-screen overflow-x-hidden bg-[#101010]">
            <Navbar />
            <Hero />
            <Features />
            <section className="py-24 md:py-32" id="pricing">
                <Container>
                    <div className="mb-16 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4 font-sans text-foreground">
                            Simple, transparent pricing
                        </h2>
                        <p className="text-white/60 max-w-2xl mx-auto">
                            No hidden fees. Support the open-source project and unlock premium customization features forever.
                        </p>
                    </div>
                    <PricingTableOne 
                        theme="classic" 
                        plans={plans}
                        onPlanSelect={() => navigate({ to: '/pricing' })}
                    />
                </Container>
            </section>
            <Footer />
        </main>
    );
}
