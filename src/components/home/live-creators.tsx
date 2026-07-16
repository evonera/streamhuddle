// @ts-nocheck
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion } from 'motion/react'
import { Link } from '@tanstack/react-router'
import Container from './container'

export default function LiveCreators() {
    const creatorsQuery = useQuery(api.roster.getAllCreators, {})
    const liveCreators = (creatorsQuery || []).filter(c => c.isLive)
    const offlineCreators = (creatorsQuery || []).filter(c => !c.isLive).slice(0, 4)

    // Don't render if no data yet
    if (!creatorsQuery) return null
    if (creatorsQuery.length === 0) return null

    return (
        <section className="relative w-full py-24 border-t border-white/5">
            {/* Subtle dot grid background matching hero */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

            <Container className="relative z-10">
                {/* Section header */}
                <div className="flex items-end justify-between mb-12">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            {liveCreators.length > 0 && (
                                <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {liveCreators.length} Live Now
                                </div>
                            )}
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold font-sans text-foreground">
                            Streamer University
                        </h2>
                        <p className="text-white/50 text-sm max-w-md font-mono">
                            Watch all streamers in one grid, build your own layout, or discover community setups.
                        </p>
                    </div>
                    <Link
                        to="/university"
                        className="hidden md:inline-flex items-center gap-2 border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        Open University →
                    </Link>
                </div>

                {/* Live creators grid */}
                {liveCreators.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                        {liveCreators.map((creator, i) => (
                            <motion.div
                                key={creator._id}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-60px' }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
                            >
                                <Link
                                    to="/roster"
                                    className="group relative flex flex-col gap-2 p-3 border border-white/5 bg-white/2 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 cursor-pointer"
                                >
                                    {/* Live badge */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase font-mono z-10">
                                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                        Live
                                    </div>

                                    <div className="relative">
                                        <img
                                            src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`}
                                            alt={creator.username}
                                            className="w-full aspect-square object-cover bg-zinc-900"
                                        />
                                        {/* Primary overlay on hover */}
                                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>

                                    <div>
                                        <div className="text-white text-xs font-bold font-mono truncate">{creator.username}</div>
                                        <div className="text-white/40 text-[10px] capitalize font-mono">{creator.platform}</div>
                                        {creator.viewerCount && (
                                            <div className="text-primary text-[10px] font-mono mt-0.5">
                                                {creator.viewerCount.toLocaleString()} viewers
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Offline strip */}
                {offlineCreators.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                        <span className="text-white/20 text-xs font-mono uppercase tracking-widest self-center mr-2">Also on roster:</span>
                        {offlineCreators.map(c => (
                            <Link
                                key={c._id}
                                to="/roster"
                                className="inline-flex items-center gap-1.5 border border-white/5 bg-white/2 px-2.5 py-1 text-xs text-white/40 font-mono hover:text-white/70 hover:border-white/10 transition-colors"
                            >
                                <img src={c.avatarUrl || `https://avatar.vercel.sh/${c.username}`} className="w-4 h-4 rounded-full grayscale" />
                                {c.username}
                            </Link>
                        ))}
                        <Link to="/roster" className="inline-flex items-center gap-1 text-xs text-white/30 font-mono hover:text-primary transition-colors ml-1">
                            + view all
                        </Link>
                    </div>
                )}

                {/* CTA row */}
                <div className="flex flex-wrap gap-3 mt-10">
                    <Link
                        to="/university"
                        className="inline-flex items-center gap-2 bg-primary text-background font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
                    >
                        Open University
                    </Link>
                    <Link
                        to="/roster"
                        className="inline-flex items-center gap-2 border border-white/10 text-white font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-white/5 transition-colors active:scale-[0.97]"
                    >
                        Build Custom Grid
                    </Link>
                    <Link
                        to="/discover"
                        className="inline-flex items-center gap-2 text-white/40 font-mono text-xs hover:text-white/70 transition-colors px-3 py-3"
                    >
                        Discover community setups →
                    </Link>
                </div>
            </Container>
        </section>
    )
}
