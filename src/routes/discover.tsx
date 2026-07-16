// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'motion/react'
import Navbar from '@/components/home/navbar'
import Footer from '@/components/home/footer'
import Container from '@/components/home/container'
import CreateStreamlistBar from '@/components/create-streamlist-bar'

export const Route = createFileRoute('/discover')({
  component: DiscoverPage,
})

function DiscoverPage() {
  const streamLists = useQuery(api.roster.getDiscoverStreamLists)
  const creatorsQuery = useQuery(api.roster.getAllCreators, {})

  const liveCreators = (creatorsQuery || []).filter(c => c.isLive).slice(0, 8)

  return (
    <main className="dark min-h-screen overflow-x-hidden bg-[#101010] text-foreground">
      <Navbar />

      <div className="pt-24 pb-0">

        {/* Page header */}
        <section className="relative border-b border-white/5 py-16">
          {/* Dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
          {/* Ambient glow */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(163,255,18,0.05) 0%, transparent 70%)' }} />

          <Container className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-primary text-xs font-bold tracking-widest uppercase font-mono">
                Community
              </span>
              <span className="h-px w-8 bg-primary/30" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-sans text-foreground mb-4 leading-tight">
              Discover
            </h1>
            <p className="text-white/50 font-mono text-sm max-w-lg">
              Explore the most popular StreamLists curated by the community, or jump straight into the action.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/roster"
                className="inline-flex items-center gap-2 bg-primary text-background font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
              >
                Build Your Grid
              </Link>
              <Link
                to="/university"
                className="inline-flex items-center border border-white/10 text-white font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-white/5 transition-colors active:scale-[0.97]"
              >
                Open University
              </Link>
            </div>
            
            <div className="mt-12 mb-8">
              <CreateStreamlistBar />
            </div>
          </Container>
        </section>

        {/* Live Now */}
        {liveCreators.length > 0 && (
          <section className="border-b border-white/5 py-16">
            <Container>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live Now
                  </div>
                  <span className="text-white/30 text-xs font-mono">{liveCreators.length} streaming</span>
                </div>
                <Link to="/roster" className="text-xs text-white/30 font-mono hover:text-white/60 transition-colors">
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {liveCreators.map((creator, i) => (
                  <motion.div
                    key={creator._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to="/roster"
                      className="group relative flex flex-col gap-2 p-2 border border-white/5 hover:border-primary/30 hover:bg-white/3 transition-all"
                    >
                      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 uppercase font-mono">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                      <img
                        src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`}
                        alt={creator.username}
                        className="w-full aspect-square object-cover bg-zinc-900"
                      />
                      <div className="text-white text-[10px] font-bold font-mono truncate">{creator.username}</div>
                      {creator.viewerCount && (
                        <div className="text-primary text-[9px] font-mono -mt-1">
                          {creator.viewerCount.toLocaleString()}
                        </div>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Container>
          </section>
        )}

        {/* Community StreamLists */}
        <section className="py-16">
          <Container>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/40 text-xs font-bold tracking-widest uppercase font-mono">
                Community StreamLists
              </span>
              <span className="h-px flex-1 bg-white/5" />
            </div>
            <p className="text-white/30 text-xs font-mono mb-10">
              Curated multi-stream setups — click any to load it instantly
            </p>

            {!streamLists ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-40 bg-white/2 border border-white/5 animate-pulse" />
                ))}
              </div>
            ) : streamLists.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-white/10">
                <p className="text-white/30 font-mono text-sm">No StreamLists yet.</p>
                <p className="text-white/20 font-mono text-xs mt-2">Save a layout from the Roster page to appear here.</p>
                <Link to="/roster" className="inline-flex items-center gap-2 mt-6 border border-white/10 bg-white/3 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                  Build a StreamList →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                {streamLists.map((list, i) => (
                  <motion.div
                    key={list._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to="/roster"
                      search={{ list: list._id }}
                      className="group flex flex-col gap-4 p-6 bg-[#101010] hover:bg-white/3 transition-colors"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-sans font-bold text-white text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
                          {list.name}
                        </h3>
                        <span className="text-white/20 text-[10px] font-mono shrink-0">
                          {list.views.toLocaleString()} views
                        </span>
                      </div>

                      <div className="text-white/30 text-[10px] font-mono">by {list.authorName}</div>

                      {/* Stream badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {list.previewStreams.slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 border border-white/8 bg-white/2 px-2 py-0.5 text-[10px] text-white/50 font-mono"
                          >
                            {s.type === 'chat' ? '💬' : '📺'} {s.username}
                          </span>
                        ))}
                        {list.previewStreams.length > 4 && (
                          <span className="inline-flex items-center border border-white/5 bg-white/2 px-2 py-0.5 text-[10px] text-white/30 font-mono">
                            +{list.previewStreams.length - 4}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-[10px] text-white/20 font-mono">{list.previewStreams.length} streams</span>
                        <span className="text-xs text-primary font-mono font-bold group-hover:underline">Load →</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </Container>
        </section>

      </div>

      <Footer />
    </main>
  )
}
