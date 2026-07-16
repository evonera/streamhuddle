import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'motion/react'
import ViewIcon from "@hugeicons/core-free-icons/ViewIcon";
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon";
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon";
import GraduateMaleIcon from "@hugeicons/core-free-icons/GraduateMaleIcon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/discover')(({
  component: DiscoverPage,
}))

function DiscoverPage() {
  const streamLists = useQuery(api.roster.getDiscoverStreamLists)
  const creatorsQuery = useQuery(api.roster.getAllCreators, {})

  const liveCreators = (creatorsQuery || []).filter(c => c.isLive).slice(0, 12)

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground">

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg tracking-tight text-white">StreamHuddle</Link>
          <nav className="flex items-center gap-2">
            <Link to="/university" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              University
            </Link>
            <Link to="/roster" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              Roster
            </Link>
            <Link to="/roster" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Watch Now
            </Link>
          </nav>
        </div>
      </header>

      <div className="pt-14">

        {/* Hero */}
        <section className="relative overflow-hidden px-6 py-24 md:py-32">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-purple-500/5 rounded-full blur-[80px]" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {liveCreators.length > 0 ? `${liveCreators.length} creators live now` : "Community StreamLists"}
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6">
                Watch together.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-pink-400">
                  Stream smarter.
                </span>
              </h1>
              <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                Discover curated multi-stream setups built by the community, or build your own custom viewing experience in seconds.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/university"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/20"
                >
                  <HugeiconsIcon icon={GraduateMaleIcon} size={18} />
                  Open University
                </Link>
                <Link
                  to="/roster"
                  className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-all hover:scale-105"
                >
                  <HugeiconsIcon icon={Tv01Icon} size={18} />
                  Build Your Grid
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-zinc-500" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Live Now section */}
        {liveCreators.length > 0 && (
          <section className="px-6 pb-16">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-xl font-bold text-white">Live Now</h2>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                    {liveCreators.length} streaming
                  </Badge>
                </div>
                <Link to="/roster" className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
                  View all <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {liveCreators.map((creator, i) => (
                  <motion.div
                    key={creator._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      to="/roster"
                      className="group block bg-zinc-900 border border-white/5 rounded-xl p-3 hover:border-primary/40 hover:bg-zinc-800 transition-all"
                    >
                      <div className="relative mb-2">
                        <img
                          src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`}
                          alt={creator.username}
                          className="w-full aspect-square rounded-lg object-cover bg-zinc-800"
                        />
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          Live
                        </div>
                      </div>
                      <div className="text-white text-xs font-semibold truncate">{creator.username}</div>
                      <div className="text-zinc-500 text-[10px] capitalize mt-0.5">{creator.platform}</div>
                      {creator.viewerCount && (
                        <div className="text-zinc-400 text-[10px] mt-0.5">
                          {creator.viewerCount.toLocaleString()} viewers
                        </div>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Community StreamLists */}
        <section className="px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Community StreamLists</h2>
                <p className="text-zinc-500 text-sm mt-1">Curated multi-stream setups from the community</p>
              </div>
            </div>

            {!streamLists ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-44 rounded-xl bg-zinc-900/50 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : streamLists.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-zinc-950/30">
                <HugeiconsIcon icon={Tv01Icon} className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium text-zinc-400">No community StreamLists yet</p>
                <p className="text-sm text-zinc-600 mt-2">Be the first — build and save a layout from the Roster page!</p>
                <Link to="/roster" className="inline-flex items-center gap-2 mt-6 bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                  Build a StreamList <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streamLists.map((list, i) => (
                  <motion.div
                    key={list._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to="/roster"
                      search={{ list: list._id }}
                      className="block h-full group"
                    >
                      <div className="h-full bg-zinc-900 border border-white/5 rounded-xl p-5 hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h3 className="font-bold text-white text-base line-clamp-1 group-hover:text-primary transition-colors">
                              {list.name}
                            </h3>
                            <div className="flex items-center gap-1 text-zinc-500 text-xs shrink-0">
                              <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
                              {list.views.toLocaleString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-4">
                            <HugeiconsIcon icon={UserGroupIcon} className="w-3 h-3" />
                            {list.authorName}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {list.previewStreams.slice(0, 4).map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-zinc-800 border border-white/5 text-zinc-300 text-[11px] px-2 py-0.5 rounded-full"
                              >
                                {s.type === 'chat' ? '💬' : '📺'} {s.username}
                              </span>
                            ))}
                            {list.previewStreams.length > 4 && (
                              <span className="inline-flex items-center bg-zinc-800 border border-white/5 text-zinc-500 text-[11px] px-2 py-0.5 rounded-full">
                                +{list.previewStreams.length - 4} more
                              </span>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-zinc-600">{list.previewStreams.length} streams</span>
                            <span className="text-xs text-primary font-medium group-hover:underline flex items-center gap-1">
                              Open <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-white/5 px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to watch?</h2>
            <p className="text-zinc-400 mb-8">Head to the Roster or University page to start building your perfect multi-stream setup.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/university" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                <HugeiconsIcon icon={GraduateMaleIcon} size={18} />
                University Mode
              </Link>
              <Link to="/roster" className="inline-flex items-center gap-2 border border-white/10 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/5 transition-colors">
                <HugeiconsIcon icon={Tv01Icon} size={18} />
                Custom Roster
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
