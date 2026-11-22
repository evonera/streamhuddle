import { useDraggable } from "@dnd-kit/core"
import { HugeiconsIcon } from "@hugeicons/react"
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon"
import Message01Icon from "@hugeicons/core-free-icons/Message01Icon"
import DragDropVerticalIcon from "@hugeicons/core-free-icons/DragDropVerticalIcon"

type Creator = {
  _id: string
  username: string
  platform: string
  avatarUrl?: string | null
  isLive?: boolean | null
  viewerCount?: number | null
}

function RosterAction({ creator, type, active, onAdd }: {
  creator: Creator
  type: "stream" | "chat"
  active: boolean
  onAdd: (creator: Creator, type: "stream" | "chat") => void
}) {
  const drag = useDraggable({
    id: `sidebar:${creator._id}:${type}`,
    data: { source: "sidebar", creatorId: creator._id, cellType: type, label: `${creator.username} ${type}` },
  })
  return (
    <div ref={drag.setNodeRef} className={`flex-1 min-w-0 flex rounded border border-border ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
      <button
        type="button"
        onClick={() => onAdd(creator, type)}
        aria-label={`${active ? "Remove" : "Add"} ${creator.username} ${type}`}
        aria-pressed={active}
        className="flex-1 flex items-center justify-center gap-1 p-2 text-xs transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <HugeiconsIcon icon={type === "stream" ? Tv01Icon : Message01Icon} size={14} />
        {type === "stream" ? "Stream" : "Chat"}
      </button>
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        aria-label={`Drag ${creator.username} ${type} to a grid slot`}
        title={`Drag ${type} to a grid slot`}
        style={{ touchAction: "none" }}
        className="shrink-0 flex items-center justify-center w-8 border-l border-border cursor-grab active:cursor-grabbing hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} size={14} />
      </button>
    </div>
  )
}

/** Primary buttons toggle cells; separate handles support mouse, touch, and keyboard dragging. */
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
        <RosterAction creator={creator} type="stream" active={isStreamActive} onAdd={onAdd} />
        <RosterAction creator={creator} type="chat" active={isChatActive} onAdd={onAdd} />
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
