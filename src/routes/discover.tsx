import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import { motion } from 'motion/react'
import { useState } from 'react'
import Navbar from '@/components/home/navbar'
import Footer from '@/components/home/footer'
import Container from '@/components/home/container'
import CreateStreamlistBar from '@/components/create-streamlist-bar'
import { seo } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'
import { serializeStreamsParam } from '@/lib/streams-param'

export const Route = createFileRoute('/discover')({
  head: () => ({
    meta: seo({
      title: "Discover StreamLists — StreamHuddle",
      description:
        "Explore community multi-stream setups and load any StreamList in one click. Free forever.",
      image: "/og.png",
      url: `${SITE_URL}/discover`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/discover` }],
  }),
  component: DiscoverPage,
})

type StreamList = FunctionReturnType<typeof api.roster.getDiscoverStreamLists>[number]

function StreamListCard({ list, index }: { list: StreamList; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to="/roster"
        search={{ list: list._id }}
        className="group flex flex-col gap-0 bg-card border border-border hover:border-primary/25 hover:bg-accent transition-all duration-200 overflow-hidden"
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="font-sans font-bold text-foreground text-[15px] leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {list.name}
              </h3>
              <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono">
                <span>by {list.authorName}</span>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="text-muted-foreground text-[10px] font-mono">{list.views.toLocaleString()} views</span>
              <span className="text-[10px] font-mono text-muted-foreground">{list.previewStreams.length} previews</span>
            </div>
          </div>

          {/* Stream badges with platform icons */}
          <div className="flex flex-wrap gap-1.5">
            {list.previewStreams.slice(0, 5).map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground font-mono rounded-sm"
                >
                  {s.type === 'chat' && <span className="text-[9px]">Chat ·</span>}
                  {s.username}
                </span>
            ))}
            {list.previewStreams.length > 5 && (
              <span className="inline-flex items-center border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground font-mono rounded-sm">
                +{list.previewStreams.length - 5}
              </span>
            )}
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-[10px] text-muted-foreground">Community layout</span>
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
  const upcomingQuery = useQuery(api.upcoming.getUpcomingEvents, { limit: 12 })
  const [search, setSearch] = useState('')

  const liveCreators = (creatorsQuery || []).filter((c) => c.isLive).slice(0, 8)

  const filteredLists = streamLists
    ? streamLists.filter((list) =>
        list.name.toLowerCase().includes(search.toLowerCase()) ||
        list.authorName?.toLowerCase().includes(search.toLowerCase()) ||
        list.previewStreams?.some((s) =>
          s.username?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : null

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <div className="pt-24 pb-0">

        {/* Page header */}
        <section className="relative border-b border-border py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
          <div
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 6%, transparent) 0%, transparent 70%)' }}
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
              <p className="text-muted-foreground font-mono text-sm max-w-lg mb-2">
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
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
                >
                  Build Your Grid
                </Link>
                <Link
                  to="/roster"
                  className="inline-flex items-center border border-border text-foreground font-mono font-bold tracking-widest uppercase px-6 py-3 text-xs hover:bg-muted transition-colors active:scale-[0.97]"
                >
                  Watch Live
                </Link>
              </div>

              {/* Create Streamlist bar */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase font-mono">Quick Start</span>
                  <span className="h-px w-8 bg-muted" />
                </div>
                <CreateStreamlistBar />
              </div>
            </motion.div>
          </Container>
        </section>

        {/* Live Now */}
        {liveCreators.length > 0 && (
          <section className="border-b border-border py-14">
            <Container>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live Now
                  </div>
                  <span className="text-muted-foreground text-xs font-mono">{liveCreators.length} streaming</span>
                </div>
                <Link to="/roster" className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors">
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
                      search={{ streams: serializeStreamsParam([creator]) }}
                      className="group relative flex flex-col gap-2 p-2 border border-border hover:border-primary/30 hover:bg-muted/50 transition-all"
                    >
                      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 bg-red-500 text-foreground text-[8px] font-bold px-1.5 py-0.5 uppercase font-mono">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                      <img
                        src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`}
                        alt={creator.username}
                        className="w-full aspect-square object-cover bg-muted"
                      />
                      <div className="text-foreground text-[10px] font-bold font-mono truncate">{creator.username}</div>
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

        {/* Upcoming Events */}
        {upcomingQuery && upcomingQuery.length > 0 && (
          <section className="border-b border-border py-14">
            <Container>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-widest uppercase text-primary font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Upcoming
                  </div>
                  <span className="text-muted-foreground text-xs font-mono">{upcomingQuery.length} scheduled</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcomingQuery.map((event) => {
                  const startsAt = new Date(event.startsAt)
                  const dateLabel = startsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  const timeLabel = startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                  // YouTube embeds need the video ID, not the channel handle.
                  const streamsValue =
                    event.platform === "youtube" && event.videoId
                      ? `youtube:${event.videoId}`
                      : `${event.platform}:${event.username}`
                  const watchHref = event.url && (event.platform === "youtube" && !event.videoId)
                    ? event.url
                    : null
                  return (
                    <div
                      key={event._id}
                      className="group flex flex-col gap-2 p-4 border border-border bg-card hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
                          {dateLabel} · {timeLabel}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                          {event.platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <img
                          src={event.avatarUrl || `https://avatar.vercel.sh/${event.username}`}
                          alt=""
                          className="w-9 h-9 rounded-full bg-muted object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-foreground text-xs font-bold font-mono truncate">{event.username}</div>
                          <div className="text-muted-foreground text-[11px] truncate">{event.title || "Scheduled stream"}</div>
                        </div>
                      </div>
                      {watchHref ? (
                        <a
                          href={watchHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center justify-center gap-2 border border-border px-3 py-2 text-[11px] font-bold tracking-widest uppercase font-mono text-muted-foreground hover:text-primary-foreground hover:bg-primary hover:border-primary transition-colors"
                        >
                          Watch on {event.platform}
                        </a>
                      ) : (
                        <Link
                          to="/roster"
                          search={{ streams: streamsValue }}
                          className="mt-1 inline-flex items-center justify-center gap-2 border border-border px-3 py-2 text-[11px] font-bold tracking-widest uppercase font-mono text-muted-foreground hover:text-primary-foreground hover:bg-primary hover:border-primary transition-colors"
                        >
                          Open Stream
                        </Link>
                      )}
                    </div>
                  )
                })}
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
                  <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase font-mono">
                    Community StreamLists
                  </span>
                  <span className="h-px w-8 bg-muted" />
                </div>
                <p className="text-muted-foreground text-[11px] font-mono">
                  Click any card to load that setup instantly
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <label htmlFor="discover-search" className="sr-only">Search community StreamLists by name, author or streamer</label>
                <input
                  id="discover-search"
                  type="search"
                  placeholder="Search by name, author or streamer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-72 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground font-mono text-xs pl-4 pr-9 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {!filteredLists ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-44 bg-muted/50 border border-border animate-pulse rounded-sm" />
                ))}
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-border">
                <p className="text-muted-foreground font-mono text-sm">
                  {search ? `No results for "${search}"` : 'No StreamLists yet.'}
                </p>
                {!search && (
                  <p className="text-muted-foreground font-mono text-xs mt-2">
                    Save a layout from the Roster page to appear here.
                  </p>
                )}
                {search ? (
                  <button
                    onClick={() => setSearch('')}
                    className="inline-flex items-center gap-2 mt-6 border border-border bg-muted/50 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Clear search
                  </button>
                ) : (
                  <Link
                    to="/roster"
                    className="inline-flex items-center gap-2 mt-6 border border-border bg-muted/50 px-5 py-2.5 text-xs font-bold tracking-widest uppercase font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
