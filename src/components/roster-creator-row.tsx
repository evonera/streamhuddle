import { useDraggable } from "@dnd-kit/core"
import { HugeiconsIcon } from "@hugeicons/react"
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon"
import Message01Icon from "@hugeicons/core-free-icons/Message01Icon"

type Creator = {
  _id: string
  username: string
  platform: string
  avatarUrl?: string | null
  isLive?: boolean | null
  viewerCount?: number | null
}

/**
 * One sidebar roster row. The Stream/Chat buttons work three ways:
 * click to toggle, drag onto a grid slot to place, keyboard-focusable.
 * dnd-kit's pointer sensor only starts a drag after movement, so clicks
 * pass through untouched.
 */
export function RosterCreatorRow({
  creator,
  isStreamActive,
  isChatActive,
  onAdd,
}: {
  creator: Creator
  isStreamActive: boolean
  isChatActive: boolean
  onAdd: (creator: Creator, type: "stream" | "chat", targetGridIndex?: number) => void
}) {
  const streamDrag = useDraggable({
    id: `sidebar:${creator._id}:stream`,
    data: { source: "sidebar", creatorId: creator._id, cellType: "stream", label: creator.username },
  })
  const chatDrag = useDraggable({
    id: `sidebar:${creator._id}:chat`,
    data: { source: "sidebar", creatorId: creator._id, cellType: "chat", label: `${creator.username} Chat` },
  })

  const btnBase =
    "flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition-colors cursor-grab active:cursor-grabbing"

  return (
    <div
      className={`p-2 rounded-lg border relative transition-all ${
        !creator.isLive ? 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0' : ''
      } bg-background border-border hover:border-primary/50`}
    >
      <div className="flex items-center gap-3">
        <img
          src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`}
          alt=""
          className="w-8 h-8 rounded-full bg-muted"
        />
        <div className="flex-1">
          <div className="font-semibold text-foreground text-sm leading-tight">{creator.username}</div>
          <div className="text-[10px] text-muted-foreground capitalize">{creator.platform}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
        <button
          ref={streamDrag.setNodeRef}
          {...streamDrag.listeners}
          {...streamDrag.attributes}
          style={{ touchAction: "pan-y" }}
          onClick={() => onAdd(creator, "stream")}
          title="Add stream (or drag to a grid slot)"
          className={`${btnBase} ${
            isStreamActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-zinc-800/50 hover:bg-zinc-800 text-muted-foreground'
          }`}
        >
          <HugeiconsIcon icon={Tv01Icon} size={14} /> Stream
        </button>
        <button
          ref={chatDrag.setNodeRef}
          {...chatDrag.listeners}
          {...chatDrag.attributes}
          style={{ touchAction: "pan-y" }}
          onClick={() => onAdd(creator, "chat")}
          title="Add chat (or drag to a grid slot)"
          className={`${btnBase} ${
            isChatActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-zinc-800/50 hover:bg-zinc-800 text-muted-foreground'
          }`}
        >
          <HugeiconsIcon icon={Message01Icon} size={14} /> Chat
        </button>
      </div>
      {creator.isLive ? (
        <div className="absolute top-2 right-2 flex flex-col items-end pointer-events-none">
          <div className="flex items-center gap-1 text-red-500 font-bold text-[10px] uppercase animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Live
          </div>
          {creator.viewerCount ? (
            <div className="text-[9px] font-bold text-muted-foreground bg-background/50 px-1 rounded mt-0.5">
              {creator.viewerCount.toLocaleString()} Viewers
            </div>
          ) : null}
        </div>
      ) : (
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-medium pointer-events-none">Offline</div>
      )}
    </div>
  )
}
