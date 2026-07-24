import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import CheckmarkBadge01Icon from "@hugeicons/core-free-icons/CheckmarkBadge01Icon"
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon"

interface StreamerControlPanelProps {
  creatorId: Id<"creators">
}

/**
 * Streamer-only clip queue widget.
 * Shows viewer-submitted clips sorted by upvotes with moderation controls.
 */
export function StreamerControlPanel({ creatorId }: StreamerControlPanelProps) {
  const queue = useQuery(api.clipQueue.getLiveQueue, { creatorId })
  const setStatus = useMutation(api.clipQueue.setClipStatus)
  const deleteClip = useMutation(api.clipQueue.deleteClip)

  if (!queue || queue.length === 0) return (
    <div className="flex items-center gap-2 mb-6 text-white/40 text-xs font-bold tracking-widest uppercase font-mono">
      Queue is empty
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-white/80 text-xs font-bold tracking-widest uppercase font-mono flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Streamer Control Panel
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
              {/* Rank & Upvotes */}
              <div className="flex flex-col items-center justify-center shrink-0 w-8">
                <span className="text-white/20 font-mono text-[10px] mb-1">
                  #{i + 1}
                </span>
                <span className="text-primary font-mono text-xs font-bold">
                  ▲{item.upvotes}
                </span>
              </div>

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

              {/* Moderation Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setStatus({ queueItemId: item._id, status: "played" }).catch((err) => {
                    console.error(err)
                    alert("Failed to mark as played. Please try again.")
                  })}
                  title="Mark as played (Removes from live queue)"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 text-white/60 hover:text-green-400 transition-all font-mono text-[10px] uppercase font-bold tracking-wider"
                >
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} size={14} />
                  Played
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to permanently delete this clip from the queue?")) {
                      deleteClip({ queueItemId: item._id }).catch((err) => {
                        console.error(err)
                        alert("Failed to delete clip. Please try again.")
                      })
                    }
                  }}
                  title="Delete clip permanently"
                  className="flex items-center justify-center w-8 h-8 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/40 hover:text-red-400 transition-all"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
