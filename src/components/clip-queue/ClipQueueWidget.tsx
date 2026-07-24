import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { motion, AnimatePresence } from "motion/react"

interface ClipQueueWidgetProps {
  creatorId: Id<"creators">
}

/**
 * Real-time clip queue widget for streamer pages.
 * Shows viewer-submitted clips sorted by upvotes with live animation.
 * Powered by Convex's reactive queries — updates instantly when data changes.
 */
export function ClipQueueWidget({ creatorId }: ClipQueueWidgetProps) {
  const queue = useQuery(api.clipQueue.getLiveQueue, { creatorId })
  const upvote = useMutation(api.clipQueue.upvoteClip)

  if (!queue || queue.length === 0) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-white/40 text-xs font-bold tracking-widest uppercase font-mono">
          Clip Queue
        </span>
        <span className="h-px flex-1 bg-white/5" />
        <span className="bg-primary/20 text-primary text-[10px] font-mono font-bold tracking-widest px-2 py-0.5">
          {queue.length} {queue.length === 1 ? "clip" : "clips"}
        </span>
      </div>

      {/* Queue Items */}
      <div className="border border-white/10 bg-[#141414] overflow-hidden">
        <AnimatePresence mode="popLayout">
          {queue.map((item, i) => (
            <motion.div
              key={item._id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              {/* Rank */}
              <span className="text-white/20 font-mono text-xs w-5 text-right shrink-0">
                {i + 1}
              </span>

              {/* Thumbnail */}
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="w-16 h-9 object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-16 h-9 bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a
                  href={item.clipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white text-xs font-medium truncate block hover:text-primary transition-colors"
                >
                  {item.title}
                </a>
                <span className="text-white/30 text-[10px] font-mono">
                  by {item.submitterName}
                </span>
              </div>

              {/* Upvote Button */}
              <button
                onClick={() => upvote({ queueItemId: item._id }).catch(console.error)}
                className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all group shrink-0"
              >
                <svg
                  className="h-3 w-3 text-white/40 group-hover:text-primary transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 4l-8 8h5v8h6v-8h5z" />
                </svg>
                <span className="text-white font-mono text-[11px] font-bold group-hover:text-primary transition-colors">
                  {item.upvotes}
                </span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
