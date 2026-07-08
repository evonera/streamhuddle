import Navbar from './navbar';
import Hero from './hero';
import Stats from './stats';
import Features from './features';
import AnimatedBento from './animated-bento';
import ComponentsBento from './component-bento';
import TemplateBento from './template-bento';
import Testimonial from './testimonials';
import Footer from './footer';

export default function Landing01Demo() {
    return (
        <main className="dark min-h-screen overflow-x-hidden bg-[#101010]">
            <Navbar />
            <Hero />
            <Stats />
            <Features />
            <AnimatedBento />
            <ComponentsBento />
            <TemplateBento />
            <Testimonial />
            <Footer />
        </main>
    );
}
