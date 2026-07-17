// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'motion/react'
import { useState } from 'react'
import Navbar from '@/components/home/navbar'
import Footer from '@/components/home/footer'
import Container from '@/components/home/container'
import CreateStreamlistBar from '@/components/create-streamlist-bar'

export const Route = createFileRoute('/discover')({
  component: DiscoverPage,
})

const PLATFORM_COLORS = {
  twitch: '#9146FF',
  kick: '#53FC18',
  youtube: '#FF0000',
  rumble: '#85C742',
}

const PLATFORM_ICONS = {
  twitch: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="#9146FF">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  ),
  kick: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="#53FC18">
      <path d="M2 2h4v8.5l5-5V2h4v8.5L20 5v5l-5 5 5 5v-5l-5-5.5V22h-4v-8.5l-5 5V22H2z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="#FF0000">
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  ),
}

function getPlatformFromType(type: string, username: string) {
  if (type === 'chat') return null
  // basic heuristic — in real data this would be a field
  return 'twitch'
}

function StreamListCard({ list, index }: { list: any; index: number }) {
  const platformBreakdown: Record<string, number> = {}
  list.previewStreams.forEach((s: any) => {
    const p = s.platform || 'twitch'
    platformBreakdown[p] = (platformBreakdown[p] || 0) + 1
  })

  const liveCount = list.previewStreams.filter((s: any) => s.isLive).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to="/roster"
        search={{ list: list._id }}
        className="group flex flex-col gap-0 bg-[#141414] border border-white/5 hover:border-primary/25 hover:bg-[#181818] transition-all duration-200 overflow-hidden"
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="font-sans font-bold text-white text-[15px] leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {list.name}
              </h3>
              <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-mono">
                <span>by {list.authorName}</span>
                {liveCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse inline-block" />
                      {liveCount} live
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="text-white/20 text-[10px] font-mono">{list.views.toLocaleString()} views</span>
              <span className="text-[10px] font-mono text-white/15">{list.previewStreams.length} streams</span>
            </div>
          </div>

          {/* Stream badges with platform icons */}
          <div className="flex flex-wrap gap-1.5">
            {list.previewStreams.slice(0, 5).map((s: any, idx: number) => {
              const platform = s.platform || 'twitch'
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 border border-white/8 bg-white/3 px-2 py-1 text-[10px] text-white/60 font-mono rounded-sm"
                >
                  {s.type !== 'chat' && PLATFORM_ICONS[platform] ? (
                    PLATFORM_ICONS[platform]
                  ) : (
                    <span className="text-[9px]">💬</span>
                  )}
                  {s.username}
                </span>
              )
            })}
            {list.previewStreams.length > 5 && (
              <span className="inline-flex items-center border border-white/5 bg-white/2 px-2 py-1 text-[10px] text-white/30 font-mono rounded-sm">
                +{list.previewStreams.length - 5}
              </span>
            )}
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              {Object.entries(platformBreakdown).map(([p, count]) => (
                <span key={p} className="flex items-center gap-1 text-[9px] font-mono text-white/30">
                  {PLATFORM_ICONS[p] || null}
                  {count}
                </span>
              ))}
            </div>
            <span className="text-xs text-primary font-mono font-bold group-hover:underline transition-all">
              Load setup →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function DiscoverPage() {
  const streamLists = useQuery(api.roster.getDiscoverStreamLists)
  const creatorsQuery = useQuery(api.roster.getAllCreators, {})
  const [search, setSearch] = useState('')

  const liveCreators = (creatorsQuery || []).filter((c) => c.isLive).slice(0, 8)

  const filteredLists = streamLists
    ? streamLists.filter((list) =>
        list.name.toLowerCase().includes(search.toLowerCase()) ||
        list.authorName?.toLowerCase().includes(search.toLowerCase()) ||
        list.previewStreams?.some((s: any) =>
          s.username?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : null

  return (
    <main className="dark min-h-screen overflow-x-hidden bg-[#101010] text-foreground">
      <Navbar />

      <div className="pt-24 pb-0">

        {/* Page header */}
        <section className="relative border-b border-white/5 py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
          <div
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(163,255,18,0.06) 0%, transparent 70%)' }}
          />

          <Container className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-primary text-xs font-bold tracking-widest uppercase font-mono">Community</span>
                <span className="h-px w-8 bg-primary/30" />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold font-sans text-foreground mb-4 leading-tight">
                Discover
              </h1>
              <p className="text-white/40 font-mono text-sm max-w-lg mb-2">
                Explore community StreamLists — pre-built multi-stream setups you can load in one click.
              </p>
              {streamLists && (
                <p className="text-primary/60 font-mono text-xs mb-8">
                  {streamLists.length} StreamLists available
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-6 mb-10">
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

              {/* Create Streamlist bar */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-white/30 text-xs font-bold tracking-widest uppercase font-mono">Quick Start</span>
                  <span className="h-px w-8 bg-white/10" />
                </div>
                <CreateStreamlistBar />
              </div>
            </motion.div>
          </Container>
        </section>

        {/* Live Now */}
        {liveCreators.length > 0 && (
          <section className="border-b border-white/5 py-14">
            <Container>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
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
                      to="/streamer/$username"
                      params={{ username: creator.username }}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/40 text-xs font-bold tracking-widest uppercase font-mono">
                    Community StreamLists
                  </span>
                  <span className="h-px w-8 bg-white/5" />
                </div>
                <p className="text-white/25 text-[11px] font-mono">
                  Click any card to load that setup instantly
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, author or streamer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-72 bg-white/3 border border-white/10 text-white placeholder-white/20 font-mono text-xs px-4 py-2.5 outline-none focus:border-primary/40 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {!filteredLists ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-44 bg-white/2 border border-white/5 animate-pulse rounded-sm" />
                ))}
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-white/10">
                <p className="text-white/30 font-mono text-sm">
                  {search ? `No results for "${search}"` : 'No StreamLists yet.'}
                </p>
                {!search && (
                  <p className="text-white/20 font-mono text-xs mt-2">
                    Save a layout from the Roster page to appear here.
                  </p>
                )}
                {search ? (
                  <button
                    onClick={() => setSearch('')}
                    className="inline-flex items-center gap-2 mt-6 border border-white/10 bg-white/3 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Clear search
                  </button>
                ) : (
                  <Link
                    to="/roster"
                    className="inline-flex items-center gap-2 mt-6 border border-white/10 bg-white/3 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Build a StreamList →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLists.map((list, i) => (
                  <StreamListCard key={list._id} list={list} index={i} />
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
