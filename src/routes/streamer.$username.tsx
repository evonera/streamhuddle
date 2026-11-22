import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { useEffect, useState } from 'react'
import { SITE_URL } from '@/lib/site'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { requestStreamerProfile } from '@/lib/streamer-profile.server'

import { motion } from 'motion/react'
import Navbar from '@/components/home/navbar'
import Footer from '@/components/home/footer'
import Container from '@/components/home/container'

import { ClipQueueWidget } from "@/components/clip-queue/ClipQueueWidget"
import { StreamerControlPanel } from "@/components/clip-queue/StreamerControlPanel"
import { ChatQueueListener } from "@/components/clip-queue/ChatQueueListener"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { StreamerData } from "@convex/streamerData"
type TwitchClip = StreamerData["clips"][number]

// Provider work, cache leases, and rate budgets are shared across all app
// instances in Convex. This server function only forwards trusted edge identity.
const fetchStreamerData = createServerFn({ method: 'GET' })
  .validator(z.object({ username: z.string() }))
  .handler(async ({ data }) => {
    const profile = await requestStreamerProfile(getRequest(), data.username)
    if (profile.status === "rate-limited") setResponseStatus(429)
    return profile
  })

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/streamer/$username')({
  loader: async ({ params }) => {
    return fetchStreamerData({ data: { username: params.username } })
  },
  head: ({ loaderData, params }) => {
    if (!loaderData || !loaderData.user) return { meta: [] }
    const { user, stream } = loaderData
    const title = stream
      ? `${user.displayName} is LIVE — Watch on StreamHuddle`
      : `${user.displayName} — Streamer Profile · StreamHuddle`
    const description = stream
      ? `${user.displayName} is live playing ${stream.gameName} with ${stream.viewerCount.toLocaleString()} viewers. Watch now on StreamHuddle.`
      : user.description || `Watch ${user.displayName}'s streams on StreamHuddle. Multi-stream viewing for everyone.`
    const image = user.profileImageUrl

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: image },
        { property: 'og:type', content: 'profile' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: image },
      ],
      links: [
        { rel: 'canonical', href: new URL(`/streamer/${encodeURIComponent(params.username)}`, SITE_URL).toString() },
      ],
    }
  },
  component: StreamerProfilePage,
})

// ─── Components ──────────────────────────────────────────────────────────────

function formatViewerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}



function getStreamDuration(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function StreamerProfilePage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setRetrying(true)
    try { await router.invalidate() } catch { /* retain the useful retry state */ } finally { setRetrying(false) }
  }
  const [parentDomain, setParentDomain] = useState(() => new URL(SITE_URL).hostname)

  const creator = useQuery(api.creators.getByUsername, data.user ? {
    platform: "twitch",
    username: data.user.login,
  } : "skip")

  const currentUser = useQuery(api.users.getMe)
  const twitchAccount = useQuery(api.twitchAccount.getMyTwitchAccount, currentUser ? {} : "skip")
  const isStreamer = currentUser && creator && (
    currentUser.role === "admin" ||
    (creator.platform === "twitch" && !!creator.platformId && twitchAccount?.twitchUserId === creator.platformId)
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setParentDomain(window.location.hostname)
    }
  }, [])

  if (!data.user) return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 pt-24 text-center">
        <h1 className="text-2xl font-bold">{data.status === "not-found" ? "Streamer not found" : "Unable to load streamer"}</h1>
        <p className="text-muted-foreground">
          {data.status === "not-found" ? "This Twitch channel doesn't exist. Check the username or choose another streamer." : data.status === "rate-limited" ? "Too many profile requests. Try again in a minute." : "Twitch is unavailable right now. Try again in a moment."}
        </p>
        {data.status !== "not-found" && <Button onClick={retry} disabled={retrying}>{retrying ? "Retrying…" : "Try again"}</Button>}
        <Link to="/discover" className="text-sm underline underline-offset-4">Back to Discover</Link>
      </div>
      <Footer />
    </main>
  )

  const { user, stream, channel, clips } = data
  const channelDetails: NonNullable<StreamerData["channel"]> = channel ?? {
    gameName: undefined,
    title: undefined,
    language: undefined,
  }
  const isLive = !!stream

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <div className="pt-20">
        {data.partialError && (
          <output className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm">
            <p>Some Twitch details couldn't be loaded. Try again to refresh this profile.</p>
            <Button variant="outline" size="sm" onClick={retry} disabled={retrying}>{retrying ? "Retrying…" : "Retry"}</Button>
          </output>
        )}

        {/* ── Hero banner ── */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Background: offline image or blurred thumbnail */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl scale-105"
            style={{ backgroundImage: `url(${isLive ? stream.thumbnailUrl : user.offlineImageUrl || user.profileImageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px]" />

          <Container className="relative z-10 py-16">
            <motion.div
              className="flex flex-col md:flex-row items-start md:items-center gap-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <img
                  src={user.profileImageUrl}
                  alt={user.displayName}
                  className="h-28 w-28 rounded-2xl border-2 border-border object-cover shadow-2xl"
                />
                {isLive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 font-mono shadow-lg">
                    <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-3 min-w-0">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold font-sans text-foreground leading-tight">
                    {user.displayName}
                  </h1>
                  <p className="text-muted-foreground font-mono text-sm mt-1">@{user.login}</p>
                </div>

                {isLive ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-sm font-medium line-clamp-1">{stream.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-primary font-bold">{stream.gameName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{formatViewerCount(stream.viewerCount)} viewers</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">Live for {getStreamDuration(stream.startedAt)}</span>
                    </div>
                    {stream.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {stream.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                    <span className="text-muted-foreground font-mono text-sm">{data.streamUnavailable ? "Live status unavailable" : "Offline"}</span>
                    {channelDetails.gameName && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground font-mono text-xs">Usually plays {channelDetails.gameName}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap gap-4 mt-1">
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-lg font-mono">{formatViewerCount(user.viewCount)}</span>
                    <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest">Total Views</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-2">
                  <Link
                    to="/roster"
                    search={{ streams: user.login }}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-mono font-bold tracking-widest uppercase px-5 py-2.5 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
                  >
                    + Add to SquadView
                  </Link>
                  <a
                    href={`https://twitch.tv/${user.login}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 border border-border text-foreground font-mono font-bold tracking-widest uppercase px-5 py-2.5 text-xs hover:bg-muted transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#9146FF">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                    Watch on Twitch
                  </a>
                </div>
              </div>
            </motion.div>
          </Container>
        </section>

        {/* ── Live embed ── */}
        {isLive && (
          <section className="border-b border-border py-12">
            <Container>
              <div className="flex items-center gap-2 mb-6">
                <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live Stream
                </div>
                <span className="text-muted-foreground text-xs font-mono">{formatViewerCount(stream.viewerCount)} watching now</span>
              </div>
              <motion.div
                className="relative w-full overflow-hidden border border-border bg-black shadow-2xl"
                style={{ paddingBottom: '56.25%' }}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <iframe
                  key={parentDomain}
                  className="absolute inset-0 h-full w-full"
                  src={`https://player.twitch.tv/?channel=${user.login}&parent=${parentDomain}&autoplay=false`}
                  allowFullScreen
                  title={`${user.displayName} live stream`}
                />
              </motion.div>
            </Container>
          </section>
        )}

        {/* ── Clip Queue (only when live + creator exists) ── */}
        {isLive && creator && (
          <section className="border-b border-border py-12">
            <Container>
              {isStreamer && <ChatQueueListener channelName={data.user.login} creatorId={creator._id} />}
              {isStreamer ? (
                <StreamerControlPanel creatorId={creator._id} />
              ) : (
                <ClipQueueWidget creatorId={creator._id} />
              )}
            </Container>
          </section>
        )}

        {/* ── About ── */}
        {user.description && (
          <section className="border-b border-border py-12">
            <Container>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase font-mono">About</span>
                <span className="h-px flex-1 bg-muted" />
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl font-mono">{user.description}</p>
            </Container>
          </section>
        )}

        {/* ── Top Clips ── */}
        {clips.length > 0 && (
          <section className="border-b border-border py-12">
            <Container>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase font-mono">Top Clips</span>
                  <span className="h-px w-8 bg-muted" />
                </div>
                <a
                  href={`https://twitch.tv/${user.login}/clips`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                >
                  See all on Twitch →
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((clip: TwitchClip, i: number) => (
                  <motion.a
                    key={clip.id}
                    href={clip.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative flex flex-col overflow-hidden border border-border hover:border-primary/30 bg-card hover:bg-accent transition-all"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 + 0.2 }}
                  >
                    {/* Thumbnail */}
                    <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      <img
                        src={clip.thumbnail_url}
                        alt={clip.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="h-12 w-12 rounded-full bg-muted-foreground/20 backdrop-blur-sm flex items-center justify-center">
                          <svg className="h-5 w-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5">
                        {Math.floor(clip.duration / 60)}:{String(Math.round(clip.duration % 60)).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1">
                      <p className="text-foreground text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {clip.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] font-mono">{formatViewerCount(clip.view_count)} views</span>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </Container>
          </section>
        )}

        {/* ── Add to SquadView CTA ── */}
        <section className="py-20">
          <Container>
            <motion.div
              className="relative border border-border bg-muted/50 p-12 text-center overflow-hidden"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 4%, transparent) 0%, transparent 70%)' }}
              />
              <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase mb-3">Multi-stream with {user.displayName}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Add to your <span className="text-primary">SquadView</span>
              </h2>
              <p className="text-muted-foreground font-mono text-sm max-w-md mx-auto mb-8">
                Watch {user.displayName} alongside any other streamers — all in one screen, zero tab switching.
              </p>
              <Link
                to="/roster"
                search={{ streams: user.login }}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-mono font-bold tracking-widest uppercase px-8 py-3.5 text-sm hover:bg-primary/90 transition-colors active:scale-[0.97]"
              >
                Open in SquadView →
              </Link>
            </motion.div>
          </Container>
        </section>

      </div>

      <Footer />
    </main>
  )
}
