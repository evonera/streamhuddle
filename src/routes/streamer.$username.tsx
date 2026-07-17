import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'

interface TwitchUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
  offline_image_url: string
  description: string
  view_count: number
}

interface TwitchStream {
  title: string
  game_name: string
  viewer_count: number
  started_at: string
  thumbnail_url: string
  tags: string[]
}

interface TwitchChannel {
  game_name: string
  title: string
  broadcaster_language: string
}

interface TwitchClip {
  id: string
  url: string
  title: string
  thumbnail_url: string
  duration: number
  view_count: number
  game_id: string
}
import { motion } from 'motion/react'
import Navbar from '@/components/home/navbar'
import Footer from '@/components/home/footer'
import Container from '@/components/home/container'

// ─── Twitch API helpers ──────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getTwitchToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET')

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error('Failed to get Twitch token')
  const data = await res.json()
  _cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return _cachedToken.token
}

async function twitchFetch(path: string) {
  const clientId = process.env.TWITCH_CLIENT_ID!
  const token = await getTwitchToken()
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(`Twitch API error: ${res.status} ${path}`)
  return res.json()
}

// ─── Server function ─────────────────────────────────────────────────────────

const fetchStreamerData = createServerFn({ method: 'GET' })
  .validator((d: { username: string }) => d)
  .handler(async ({ data }) => {
    const { username } = data

    // 1. Get user
    const usersData = await twitchFetch(`/users?login=${username}`)
    if (!usersData.data?.length) throw notFound()
    const user = usersData.data[0] as TwitchUser
    const broadcasterId = user.id

    // 2. Get live status, channel info, clips, and follower count in parallel
    const [streamsData, channelData, clipsData, followersData] = await Promise.all([
      twitchFetch(`/streams?user_id=${broadcasterId}`),
      twitchFetch(`/channels?broadcaster_id=${broadcasterId}`),
      twitchFetch(`/clips?broadcaster_id=${broadcasterId}&first=6`),
      twitchFetch(`/channels/followers?broadcaster_id=${broadcasterId}`),
    ])

    const stream = (streamsData.data?.[0] as TwitchStream | undefined) ?? null
    const channel = (channelData.data?.[0] as TwitchChannel | undefined) ?? ({} as TwitchChannel)
    const clips = (clipsData.data as TwitchClip[] | undefined) ?? []
    const followerCount = (followersData.total as number | undefined) ?? 0

    return {
      user: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        offlineImageUrl: user.offline_image_url,
        description: user.description,
        viewCount: user.view_count,
      },
      stream: stream
        ? {
            title: stream.title,
            gameName: stream.game_name,
            viewerCount: stream.viewer_count,
            startedAt: stream.started_at,
            thumbnailUrl: stream.thumbnail_url
              ?.replace('{width}', '640')
              .replace('{height}', '360'),
            tags: stream.tags ?? [],
          }
        : null,
      channel: {
        gameName: channel.game_name,
        title: channel.title,
        language: channel.broadcaster_language,
      },
      clips,
      followerCount,
    }
  })

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/streamer/$username')({
  loader: async ({ params }) => {
    return fetchStreamerData({ data: { username: params.username } })
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [] }
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
        { rel: 'canonical', href: `https://streamhuddle.pages.dev/streamer/${params.username}` },
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

function formatFollowerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
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
  Route.useParams()
  const [parentDomain, setParentDomain] = useState('streamhuddle.pages.dev')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setParentDomain(window.location.hostname)
    }
  }, [])

  if (!data) return null

  const { user, stream, channel, clips, followerCount } = data
  const isLive = !!stream

  return (
    <main className="dark min-h-screen overflow-x-hidden bg-[#101010] text-foreground">
      <Navbar />

      <div className="pt-20">

        {/* ── Hero banner ── */}
        <section className="relative overflow-hidden border-b border-white/5">
          {/* Background: offline image or blurred thumbnail */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl scale-105"
            style={{ backgroundImage: `url(${isLive ? stream.thumbnailUrl : user.offlineImageUrl || user.profileImageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#101010]/60 via-transparent to-[#101010]" />
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
                  className="h-28 w-28 rounded-2xl border-2 border-white/10 object-cover shadow-2xl"
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
                  <h1 className="text-4xl md:text-5xl font-bold font-sans text-white leading-tight">
                    {user.displayName}
                  </h1>
                  <p className="text-white/40 font-mono text-sm mt-1">@{user.login}</p>
                </div>

                {isLive ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-white/80 text-sm font-medium line-clamp-1">{stream.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-primary font-bold">{stream.gameName}</span>
                      <span className="text-white/30">·</span>
                      <span className="text-white/50">{formatViewerCount(stream.viewerCount)} viewers</span>
                      <span className="text-white/30">·</span>
                      <span className="text-white/50">Live for {getStreamDuration(stream.startedAt)}</span>
                    </div>
                    {stream.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {stream.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/50">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="text-white/40 font-mono text-sm">Offline</span>
                    {channel.gameName && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-white/40 font-mono text-xs">Usually plays {channel.gameName}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap gap-4 mt-1">
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-lg font-mono">{formatFollowerCount(followerCount)}</span>
                    <span className="text-white/30 text-[10px] font-mono uppercase tracking-widest">Followers</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-lg font-mono">{formatViewerCount(user.viewCount)}</span>
                    <span className="text-white/30 text-[10px] font-mono uppercase tracking-widest">Total Views</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mt-2">
                  <Link
                    to="/roster"
                    // @ts-expect-error - search param typing for streams
                    search={{ streams: user.login }}
                    className="inline-flex items-center gap-2 bg-primary text-background font-mono font-bold tracking-widest uppercase px-5 py-2.5 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
                  >
                    + Add to SquadView
                  </Link>
                  <a
                    href={`https://twitch.tv/${user.login}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 border border-white/10 text-white font-mono font-bold tracking-widest uppercase px-5 py-2.5 text-xs hover:bg-white/5 transition-colors"
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
          <section className="border-b border-white/5 py-12">
            <Container>
              <div className="flex items-center gap-2 mb-6">
                <div className="inline-flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-widest uppercase text-red-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live Stream
                </div>
                <span className="text-white/30 text-xs font-mono">{formatViewerCount(stream.viewerCount)} watching now</span>
              </div>
              <motion.div
                className="relative w-full overflow-hidden border border-white/10 bg-black shadow-2xl"
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

        {/* ── About ── */}
        {user.description && (
          <section className="border-b border-white/5 py-12">
            <Container>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-white/30 text-xs font-bold tracking-widest uppercase font-mono">About</span>
                <span className="h-px flex-1 bg-white/5" />
              </div>
              <p className="text-white/60 text-sm leading-relaxed max-w-2xl font-mono">{user.description}</p>
            </Container>
          </section>
        )}

        {/* ── Top Clips ── */}
        {clips.length > 0 && (
          <section className="border-b border-white/5 py-12">
            <Container>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs font-bold tracking-widest uppercase font-mono">Top Clips</span>
                  <span className="h-px w-8 bg-white/5" />
                </div>
                <a
                  href={`https://twitch.tv/${user.login}/clips`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/30 font-mono hover:text-white/60 transition-colors"
                >
                  See all on Twitch →
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((clip: any, i: number) => (
                  <motion.a
                    key={clip.id}
                    href={clip.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative flex flex-col overflow-hidden border border-white/5 hover:border-primary/30 bg-[#141414] hover:bg-[#181818] transition-all"
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
                        <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
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
                      <p className="text-white text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {clip.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-white/30 text-[10px] font-mono">{clip.game_id ? channel.gameName : ''}</span>
                        <span className="text-white/30 text-[10px] font-mono">{formatViewerCount(clip.view_count)} views</span>
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
              className="relative border border-white/8 bg-white/2 p-12 text-center overflow-hidden"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at center, rgba(163,255,18,0.04) 0%, transparent 70%)' }}
              />
              <p className="text-white/30 font-mono text-xs tracking-widest uppercase mb-3">Multi-stream with {user.displayName}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Add to your <span className="text-primary">SquadView</span>
              </h2>
              <p className="text-white/40 font-mono text-sm max-w-md mx-auto mb-8">
                Watch {user.displayName} alongside any other streamers — all in one screen, zero tab switching.
              </p>
              <Link
                to="/roster"
                // @ts-expect-error - search param typing for streams
                search={{ streams: user.login }}
                className="inline-flex items-center gap-2 bg-primary text-background font-mono font-bold tracking-widest uppercase px-8 py-3.5 text-sm hover:bg-primary/90 transition-colors active:scale-[0.97]"
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
