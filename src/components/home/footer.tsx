// @ts-nocheck
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import NewTwitterIcon from "@hugeicons/core-free-icons/NewTwitterIcon";
import GithubIcon from "@hugeicons/core-free-icons/GithubIcon";
import DiscordIcon from "@hugeicons/core-free-icons/DiscordIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from '@/lib/utils';
import LogoIcon from '@/assets/logo-icon';

function Crosshair({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
    const isTop = position.startsWith('top');
    const isLeft = position.endsWith('left');

    return (
        <div className={cn(
            "pointer-events-none absolute h-8 w-8",
            isTop ? "top-0" : "bottom-0",
            isLeft ? "left-0" : "right-0"
        )}>
            <div className={cn("absolute h-full w-px bg-white/10", isTop ? "top-0" : "bottom-0", isLeft ? "left-4" : "right-4")} />
            <div className={cn("absolute h-px w-full bg-white/10", isTop ? "top-4" : "bottom-4", isLeft ? "left-0" : "right-0")} />
        </div>
    );
}

function FooterLinkColumn({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-5">
            <div className="text-primary mb-2 flex gap-2 font-mono text-xs tracking-widest">
                <span className="opacity-70">{'//'}</span> {title}
            </div>
            {children}
        </div>
    );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a href={href} className="text-sm text-white/50 transition-colors hover:text-white">
            {children}
        </a>
    );
}

function SocialLink({ href, icon: Icon }: { href: string; icon: any }) {
    return (
        <a
            href={href}
            className="flex h-8 w-8 items-center justify-center border border-white/10 bg-white/2 text-white/50 transition-all hover:border-white/30 hover:text-white"
        >
            <HugeiconsIcon icon={Icon} className="h-4 w-4" />
        </a>
    );
}

export default function Footer() {
    return (
        <footer className="bg-background text-foreground relative mt-24 overflow-hidden border-t border-white/5 font-mono">
            {/* Decorative Technical Crosshairs at the very edges */}
            <Crosshair position="top-left" />
            <Crosshair position="top-right" />

            <div className="relative z-10 container mx-auto px-4 pt-20 pb-12 md:px-8 lg:px-12 xl:px-16">
                {/* Top Grid */}
                <div className="relative grid grid-cols-1 gap-12 border-b border-white/5 pb-16 lg:grid-cols-12 lg:gap-8">
                    {/* Left Side: Brand & Newsletter (span 5) */}
                    <div className="flex flex-col items-start pr-0 lg:col-span-5 lg:pr-8">
                        <div className="text-primary mb-6 flex items-center gap-3 font-mono text-xs tracking-widest">
                            <img src="/icon.svg" alt="StreamHuddle Logo" className="w-6 h-6 object-contain rounded-sm" />
                            <span>STREAMHUDDLE</span>
                        </div>
                        <h3 className="mb-6 font-sans text-3xl tracking-tight text-balance md:text-5xl">
                            Building the future <br className="hidden lg:block" /> of
                            multi-streaming
                        </h3>
                        <p className="mb-8 max-w-md text-sm leading-relaxed text-pretty text-white/50">
                            StreamHuddle is the ultimate multi-stream viewing platform—beautifully designed, highly customizable, and completely free.
                        </p>

                        <a
                            href="/roster"
                            className="text-background bg-primary hover:bg-primary/90 inline-flex w-fit items-center justify-center px-8 py-4 text-xs font-bold tracking-widest uppercase transition-colors active:scale-[0.96]"
                        >
                            Get Started <HugeiconsIcon icon={ArrowUpRight01Icon} className="ml-2 h-4 w-4" />
                        </a>
                    </div>

                    {/* Right Side: Links (span 7) */}
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:col-span-7 lg:pl-8">
                        <FooterLinkColumn title="PRODUCT">
                            <FooterLink href="/roster">Roster</FooterLink>
                            <FooterLink href="/discover">Discover</FooterLink>
                            <FooterLink href="/university">University</FooterLink>
                            <FooterLink href="/pricing">Pro</FooterLink>
                        </FooterLinkColumn>

                        <FooterLinkColumn title="COMMUNITY">
                            <FooterLink href="https://ko-fi.com/streamhuddle">Ko-fi</FooterLink>
                            <FooterLink href="https://github.com/StreamHuddleHQ/streamhuddle">GitHub</FooterLink>
                            <FooterLink href="https://x.com/streamhuddlehq">X (Twitter)</FooterLink>
                        </FooterLinkColumn>

                        <FooterLinkColumn title="COMPANY">
                            <FooterLink href="/terms">Terms</FooterLink>
                            <FooterLink href="/privacy">Privacy</FooterLink>
                            <FooterLink href="/copyright">Copyright</FooterLink>
                        </FooterLinkColumn>
                    </div>

                    {/* Vertical divider line for desktop */}
                    <div className="absolute top-0 bottom-0 left-[41.666%] hidden w-px bg-white/5 lg:block" />
                </div>

                {/* Middle Section (Strip) */}
                <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden border-b border-white/5 py-6 md:flex-row">
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[16px_16px]" />
                    <div className="relative z-10 flex w-full flex-col items-center justify-between gap-6 px-2 md:flex-row">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary h-2 w-2 animate-pulse rounded-full shadow-[0_0_8px_rgba(163,255,18,0.6)]" />
                            <span className="text-primary font-mono text-xs tracking-widest uppercase">
                                Built for viewers & creators
                            </span>
                        </div>

                        {/* Cool loading bar graphic */}
                        <div className="hidden items-center gap-[2px] opacity-80 lg:flex">
                            {[...Array(30)].map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'h-4 w-1.5 transition-colors',
                                        i < 12 ? 'bg-primary' : 'bg-white/10',
                                    )}
                                />
                            ))}
                        </div>

                        <div className="text-primary font-mono text-xs tracking-widest">
                            {'[ STREAMHUDDLE ]'}
                        </div>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="flex flex-col items-start justify-between gap-8 pt-12 xl:flex-row xl:items-center">
                    <div className="flex w-full flex-col gap-8 md:flex-row md:items-center md:gap-12 xl:w-auto">
                        {/* Logo / Left */}
                        <div className="flex items-center gap-3">
                            <div className="group relative flex h-8 w-8 items-center justify-center">
                                <LogoIcon className="text-primary h-full w-full" />
                            </div>
                            <span className="font-sans text-lg font-bold tracking-tight text-white/90">
                                StreamHuddle
                            </span>
                        </div>

                        <div className="hidden flex-col border-l border-white/10 pl-8 md:flex">
                            <span className="text-xs tracking-widest text-white/40">
                                The ultimate multi-stream experience.
                            </span>
                            <span className="text-xs tracking-widest text-white/40">
                                Free. Open Source. Customizable.
                            </span>
                        </div>
                    </div>

                    <div className="flex w-full flex-col items-start justify-between gap-4 text-xs tracking-widest text-white/40 uppercase md:flex-row md:items-center md:gap-16 xl:w-auto xl:justify-end">
                        <div className="flex flex-col gap-1">
                            <span>&copy; 2026 StreamHuddle.</span>
                            <span>All rights reserved.</span>
                        </div>
                        <div className="flex gap-4 md:gap-6">
                            <a href="#" className="transition-colors hover:text-white">
                                Privacy Policy
                            </a>
                            <a href="#" className="transition-colors hover:text-white">
                                Terms of Service
                            </a>
                        </div>
                    </div>

                    <div className="flex w-full flex-col items-start gap-3 xl:w-auto xl:items-end">
                        <div className="text-primary flex items-center gap-2 font-mono text-xs tracking-widest">
                            <span className="opacity-70">{'//'}</span> CONNECT
                        </div>
                        <div className="flex items-center gap-4">
                            <SocialLink href="https://x.com/streamhuddlehq" icon={NewTwitterIcon} />
                            <SocialLink href="https://github.com/StreamHuddleHQ/streamhuddle" icon={GithubIcon} />
                            <a
                                href="https://ko-fi.com/streamhuddle"
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-8 w-8 items-center justify-center border border-white/10 bg-[#13C3FF]/10 text-[#13C3FF] transition-all hover:border-[#13C3FF]/30 hover:bg-[#13C3FF]/20"
                                aria-label="Support on Ko-fi"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.051-3.954-1.094-1.397-1.056-3.618.31-4.871.954-.875 2.548-.827 3.545.026.042.036.082.074.123.111.042-.037.081-.075.123-.111.996-.853 2.591-.901 3.545-.026 1.366 1.253 1.404 3.474.31 4.871z"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Decorative Crosshairs */}
            <Crosshair position="bottom-left" />
            <Crosshair position="bottom-right" />
        </footer>
    );
}
