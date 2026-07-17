import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

function VisualWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "pointer-events-none absolute top-0 right-0 bottom-0 hidden w-full items-center justify-end overflow-hidden opacity-100 md:flex md:w-1/2",
                className
            )}
            style={{
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%)',
                maskImage: 'linear-gradient(to right, transparent, black 20%)',
            }}
        >
            {children}
        </div>
    );
}

// Platform logo paths as simple SVG
const PLATFORM_ICONS = [
    {
        id: 'twitch',
        color: '#9146FF',
        svg: <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    },
    {
        id: 'kick',
        color: '#53FC18',
        svg: <path d="M2 2h4v8.5l5-5V2h4v8.5L20 5v5l-5 5 5 5v-5l-5-5.5V22h-4v-8.5l-5 5V22H2z" />
    },
    {
        id: 'youtube',
        color: '#FF0000',
        svg: <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    },
    {
        id: 'rumble',
        color: '#85C742',
        svg: <path d="M0 2.4A2.4 2.4 0 012.4 0h19.2A2.4 2.4 0 0124 2.4v19.2A2.4 2.4 0 0121.6 24H2.4A2.4 2.4 0 010 21.6zm5.6 3.2v12.8h3.2v-4.8h3.2l2.4 4.8H18l-2.72-5.44A4 4 0 0012 5.6zm3.2 3.2h3.2a1.6 1.6 0 010 3.2H8.8z" />
    },
];

// Orbit animation with CSS keyframes approach using motion
const ORBITS = [
    { radius: 75, duration: 8, initialAngle: 0, iconIdx: 0 },
    { radius: 75, duration: 8, initialAngle: 180, iconIdx: 1 },
    { radius: 120, duration: 14, initialAngle: 45, iconIdx: 2 },
    { radius: 120, duration: 14, initialAngle: 225, iconIdx: 3 },
];

export function PremiumComponent() {
    return (
        <VisualWrapper>
            <div className="relative flex h-[360px] w-[360px] items-center justify-center">
                {/* Center hub */}
                <motion.div
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 border border-primary/40 shadow-[0_0_30px_rgba(163,255,18,0.2)]"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                >
                    <motion.div
                        className="h-6 w-6 rounded-xl bg-primary shadow-[0_0_20px_rgba(163,255,18,0.8)]"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </motion.div>

                {/* Orbit rings */}
                {[75, 120].map((r, i) => (
                    <motion.div
                        key={r}
                        className="absolute rounded-full border border-white/8"
                        style={{ width: r * 2, height: r * 2 }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
                    />
                ))}

                {/* Orbiting platform icons */}
                {ORBITS.map((orbit, i) => {
                    const platform = PLATFORM_ICONS[orbit.iconIdx];
                    const angleRad = (orbit.initialAngle * Math.PI) / 180;
                    const cx = Math.cos(angleRad) * orbit.radius;
                    const cy = Math.sin(angleRad) * orbit.radius;
                    return (
                        <motion.div
                            key={platform.id}
                            className="absolute flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-white/10 shadow-lg"
                            style={{
                                left: '50%',
                                top: '50%',
                                marginLeft: -18,
                                marginTop: -18,
                            }}
                            initial={{ x: cx, y: cy, opacity: 0, scale: 0 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            animate={{
                                x: [
                                    Math.cos((orbit.initialAngle * Math.PI) / 180) * orbit.radius,
                                    Math.cos(((orbit.initialAngle + 90) * Math.PI) / 180) * orbit.radius,
                                    Math.cos(((orbit.initialAngle + 180) * Math.PI) / 180) * orbit.radius,
                                    Math.cos(((orbit.initialAngle + 270) * Math.PI) / 180) * orbit.radius,
                                    Math.cos((orbit.initialAngle * Math.PI) / 180) * orbit.radius,
                                ],
                                y: [
                                    Math.sin((orbit.initialAngle * Math.PI) / 180) * orbit.radius,
                                    Math.sin(((orbit.initialAngle + 90) * Math.PI) / 180) * orbit.radius,
                                    Math.sin(((orbit.initialAngle + 180) * Math.PI) / 180) * orbit.radius,
                                    Math.sin(((orbit.initialAngle + 270) * Math.PI) / 180) * orbit.radius,
                                    Math.sin((orbit.initialAngle * Math.PI) / 180) * orbit.radius,
                                ],
                            }}
                            transition={{
                                x: { duration: orbit.duration, repeat: Infinity, ease: 'linear' },
                                y: { duration: orbit.duration, repeat: Infinity, ease: 'linear' },
                                opacity: { delay: 0.5 + i * 0.1 },
                                scale: { delay: 0.5 + i * 0.1, type: 'spring' },
                            }}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={platform.color}>
                                {platform.svg}
                            </svg>
                        </motion.div>
                    );
                })}
            </div>
        </VisualWrapper>
    );
}

// StreamLists visual - animated grid of stream tiles
export function ThemingComponent() {
    const tiles = [
        { label: 'xQc', platform: 'twitch', color: '#9146FF', live: true },
        { label: 'KaiCenat', platform: 'kick', color: '#53FC18', live: true },
        { label: 'Pokimane', platform: 'youtube', color: '#FF0000', live: false },
        { label: 'shroud', platform: 'twitch', color: '#9146FF', live: true },
    ];
    return (
        <VisualWrapper className="p-8">
            <div className="flex flex-col gap-2 w-[240px]">
                <div className="flex items-center gap-2 mb-2">
                    <motion.div
                        className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_#a3ff12]"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase">My StreamList</span>
                </div>
                {tiles.map((tile, i) => (
                    <motion.div
                        key={tile.label}
                        className="flex items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 rounded"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 + 0.2, duration: 0.4 }}
                    >
                        <div className="h-1.5 w-1.5 rounded-full" style={{ background: tile.live ? '#22c55e' : '#ffffff33' }} />
                        <span className="font-mono text-[10px] text-white/80 flex-1">{tile.label}</span>
                        <span className="font-mono text-[8px] tracking-wider" style={{ color: tile.color }}>{tile.platform}</span>
                    </motion.div>
                ))}
                <motion.div
                    className="mt-2 border border-primary/20 bg-primary/5 px-3 py-1.5 rounded text-center"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <span className="font-mono text-[9px] text-primary tracking-widest uppercase">Save &amp; Share →</span>
                </motion.div>
            </div>
        </VisualWrapper>
    );
}

// Free Forever visual - animated checkmarks
export function OpenSourceComponent() {
    const items = ['No subscription', 'No paywalls', 'No limits', 'Open Source'];
    return (
        <VisualWrapper>
            <div className="relative mr-8 flex h-[360px] w-[200px] flex-col justify-center gap-3">
                {items.map((item, i) => (
                    <motion.div
                        key={item}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.12 + 0.2, duration: 0.4 }}
                    >
                        <motion.div
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/40"
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: i * 0.12 + 0.35, type: 'spring' }}
                        >
                            <motion.div
                                className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_#a3ff12]"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                            />
                        </motion.div>
                        <span className="font-mono text-[11px] text-white/70">{item}</span>
                    </motion.div>
                ))}
                <motion.div
                    className="mt-4 h-px w-full"
                    style={{ background: 'linear-gradient(to right, rgba(163,255,18,0.4), transparent)' }}
                    initial={{ scaleX: 0, originX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ delay: 0.8, duration: 1 }}
                />
                <motion.div
                    className="font-mono text-[10px] text-primary/60 tracking-widest uppercase"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                >
                    Forever free ✦
                </motion.div>
            </div>
        </VisualWrapper>
    );
}

// Zero Latency visual - animated waveform / signal bars
export function ProductionReadyComponent() {
    const bars = Array.from({ length: 20 }, (_, i) => ({
        height: 10 + Math.abs(Math.sin(i * 0.9)) * 50,
        delay: i * 0.04,
    }));
    return (
        <VisualWrapper>
            <div className="relative mr-8 flex h-[360px] w-[200px] flex-col justify-center gap-4">
                <div className="mb-1 flex items-center gap-2">
                    <motion.div
                        className="h-1.5 w-1.5 rounded-full bg-primary drop-shadow-[0_0_6px_#a3ff12]"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase">Live Signal</span>
                </div>
                <div className="flex items-end gap-[3px] h-16">
                    {bars.map((bar, i) => (
                        <motion.div
                            key={i}
                            className="w-1.5 rounded-sm bg-primary/70"
                            style={{ height: bar.height }}
                            animate={{ height: [
                                bar.height,
                                10 + Math.abs(Math.sin((i + 3) * 0.9)) * 50,
                                bar.height,
                            ]}}
                            initial={{ height: 4, opacity: 0 }}
                            whileInView={{ height: bar.height, opacity: 1 }}
                            transition={{
                                height: { duration: 1.2, repeat: Infinity, delay: bar.delay, ease: 'easeInOut' },
                                opacity: { delay: bar.delay + 0.2 },
                            }}
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                    {['0ms buffer lag', 'Native browser embed', 'HLS + RTMP ready'].map((t, i) => (
                        <motion.div
                            key={t}
                            className="font-mono text-[9px] text-white/40 flex items-center gap-2"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                        >
                            <span className="text-primary">›</span> {t}
                        </motion.div>
                    ))}
                </div>
            </div>
        </VisualWrapper>
    );
}
