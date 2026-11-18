import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion } from 'motion/react'
import { Link } from '@tanstack/react-router'
import Container from './container'
import { serializeStreamsParam } from '@/lib/streams-param'

export default function LiveCreators() {
    const creatorsQuery = useQuery(api.roster.getAllCreators, {})
    const liveCreators = (creatorsQuery || []).filter(c => c.isLive)
    const offlineCreators = (creatorsQuery || []).filter(c => !c.isLive).slice(0, 4)

    // Don't render if no data yet
    if (!creatorsQuery) return null
    if (creatorsQuery.length === 0) return null

    return (
        <section className="relative w-full py-24 border-t border-border">
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
                            Live Now
                        </h2>
                        <p className="text-muted-foreground text-sm max-w-md font-mono">
                            Watch all streamers in one grid, build your own layout, or discover community setups.
                        </p>
                    </div>
                    <Link
                        to="/roster"
                        className="hidden md:inline-flex items-center gap-2 border border-border bg-muted px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        Watch live →
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
                                    search={{ streams: serializeStreamsParam([creator]) }}
                                    className="group relative flex flex-col gap-2 p-3 border border-border bg-card hover:border-primary/40 hover:bg-muted transition-all duration-300 cursor-pointer"
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
                                            className="w-full aspect-square object-cover bg-muted"
                                        />
                                        {/* Primary overlay on hover */}
                                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>

                                    <div>
                                        <div className="text-foreground text-xs font-bold font-mono truncate">{creator.username}</div>
                                        <div className="text-muted-foreground text-[10px] capitalize font-mono">{creator.platform}</div>
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
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                        <span className="text-muted-foreground text-xs font-mono uppercase tracking-widest self-center mr-2">Also on roster:</span>
                        {offlineCreators.map(c => (
                            <Link
                                key={c._id}
                                to="/roster"
                                search={{ streams: serializeStreamsParam([c]) }}
                                className="inline-flex items-center gap-1.5 border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground font-mono hover:text-foreground hover:border-border transition-colors"
                            >
                                <img src={c.avatarUrl || `https://avatar.vercel.sh/${c.username}`} alt="" className="w-4 h-4 rounded-full grayscale" />
                                {c.username}
                            </Link>
                        ))}
                        <Link to="/roster" className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-primary transition-colors ml-1">
                            + view all
                        </Link>
                    </div>
                )}

                {/* CTA row */}
                <div className="flex flex-wrap gap-3 mt-10">
                    <Link
                        to="/roster"
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
                    >
                        Watch Live
                    </Link>
                    <Link
                        to="/roster"
                        className="inline-flex items-center gap-2 border border-border text-foreground font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-muted transition-colors active:scale-[0.97]"
                    >
                        Build Custom Grid
                    </Link>
                    <Link
                        to="/discover"
                        className="inline-flex items-center gap-2 text-muted-foreground font-mono text-xs hover:text-foreground transition-colors px-3 py-3"
                    >
                        Discover community setups →
                    </Link>
                </div>
            </Container>
        </section>
    )
}
