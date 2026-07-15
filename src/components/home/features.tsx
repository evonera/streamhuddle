import Container from './container';
import Heading from './heading';
import SubHeading from './subheading';
import { motion } from 'motion/react';
import { PremiumComponent, ThemingComponent, OpenSourceComponent, ProductionReadyComponent } from './feature-visuals';

const features = [
    {
        title: "Multi-Stream Master",
        description: "Watch Twitch, Kick, and YouTube simultaneously without ever switching tabs.",
        visual: <PremiumComponent />
    },
    {
        title: "Total Customization",
        description: "Save unlimited custom layouts, arrange your chat sidebars, and tweak the theme to match your style.",
        visual: <ThemingComponent />
    },
    {
        title: "100% Free Forever",
        description: "Open source core designed by gamers, for gamers. No subscriptions required for the essentials.",
        visual: <OpenSourceComponent />
    },
    {
        title: "Production Ready",
        description: "Built on high-performance streaming architecture for zero-latency multi-viewing.",
        visual: <ProductionReadyComponent />
    }
];

export default function Features() {
    return (
        <section className="relative w-full py-24 md:py-32">
            <Container>
                <div className="mb-16 md:mb-24 flex flex-col gap-4 text-center md:text-left">
                    <Heading as="h2" variant="medium" className="text-foreground font-sans">
                        Everything you need <br />
                        <span className="text-primary">to dominate the stream.</span>
                    </Heading>
                    <SubHeading className="max-w-2xl text-pretty">
                        We built StreamHuddle from the ground up to solve the most annoying problems with watching multiple live events at once.
                    </SubHeading>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="group relative flex h-[360px] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors hover:bg-white/[0.07]"
                        >
                            <div className="absolute inset-0 z-0">
                                {feature.visual}
                            </div>
                            <div className="relative z-10 flex flex-col gap-2">
                                <h3 className="font-sans text-xl font-bold tracking-tight text-white">{feature.title}</h3>
                                <p className="text-sm text-white/60 max-w-sm">{feature.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </Container>
        </section>
    );
}
