import { useState, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { StreamPlayer, type StreamData } from "./StreamPlayer";
import { ChatBox } from "./ChatBox";
import { motion, AnimatePresence } from "motion/react";
import Message01Icon from "@hugeicons/core-free-icons/Message01Icon";
import VolumeHighIcon from "@hugeicons/core-free-icons/VolumeHighIcon";
import VolumeMute01Icon from "@hugeicons/core-free-icons/VolumeMute01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import GridIcon from "@hugeicons/core-free-icons/GridIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

/** dnd-kit id for the droppable slot at a grid index. */
export function slotDroppableId(gridIndex: number) {
  return `slot:${gridIndex}`;
}

/** Droppable wrapper for a grid slot (filled cell or empty slot). */
function SlotShell({ gridIndex, style, className, children }: {
  gridIndex: number;
  style: React.CSSProperties;
  className: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDroppableId(gridIndex),
    data: { gridIndex },
  });
  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`${className} ${isOver ? "outline-2 outline-primary outline-dashed" : ""}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Draggable hover header for a mounted cell. The header (not the iframe)
 * initiates the drag so embedded players can't swallow pointer events.
 * Works with mouse + touch via dnd-kit's pointer sensor.
 */
function CellDragHandle({ stream, onSelect, children }: {
  stream: StreamData;
  /** focus/select the cell when its header is clicked or Enter-pressed */
  onSelect?: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `cell:${stream.id}:${stream.type || "stream"}`,
    data: {
      source: "cell",
      streamId: stream.id,
      streamType: stream.type || "stream",
      label: stream.displayName || stream.channel,
    },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${stream.displayName || stream.channel} (drag to reorder)`}
      style={{ touchAction: "none" }}
      className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity flex justify-between items-center z-50 cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

// Picks a column count that pairs with the flex-row renderer below so the
// last (possibly partial) row always stretches to fill the width instead of
// leaving empty cells.
function getColumnsForCount(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;   // single row — avoids an awkward 2+1 split
  if (n === 4) return 2;   // 2x2
  if (n <= 6) return 3;    // 5 -> 3+2, 6 -> 3+3
  if (n <= 8) return 4;    // 7 -> 4+3, 8 -> 4+4
  return Math.ceil(Math.sqrt(n));
}

function chunkIntoRows<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

// Grid cells layout logic

export function StreamGrid({
  streams,
  gridSize = "auto",
  onRemoveStream,
  activeChatId,
  setActiveChatId,
  onAddStreamClick,
  globalMuted = false,
  twitchQuality,
  remountKey = 0,
  liveMap,
  forceMountIds,
  onRetryStream,
  onStartTour,
}: {
  streams: StreamData[];
  gridSize?: "auto" | number;
  onRemoveStream: (id: string, type: "stream" | "chat") => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddStreamClick?: (gridIndex?: number) => void;
  /** when true, every cell renders muted (mute-all) */
  globalMuted?: boolean;
  /** explicit Twitch quality override; undefined = Auto */
  twitchQuality?: string;
  /** bump to force all players to re-init (reload-all) */
  remountKey?: number;
  /** stream.id -> isLive for roster streams; missing = unknown (mount normally) */
  liveMap?: Record<string, boolean>;
  /** ids the user explicitly retried: mount a player despite offline status */
  forceMountIds?: Record<string, true>;
  /** retry handler for offline placeholders */
  onRetryStream?: (id: string) => void;
  /** opens the onboarding tour from the empty state */
  onStartTour?: () => void;
}) {
  const [kickRemountKey, setKickRemountKey] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [manuallyUnmuted, setManuallyUnmuted] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Ensure there is always a focused stream if streams exist
    if (!focusedId || !streams.some((s) => s.id === focusedId)) {
      setFocusedId(streams[0]?.id ?? null);
      setManuallyUnmuted(new Set()); // Reset on auto-focus
    }
  }, [streams, focusedId]);



  let cells: { stream: StreamData | null; gridIndex: number }[] = [];
  if (gridSize === "auto") {
    cells = streams.map((stream, idx) => ({ stream, gridIndex: stream.gridIndex ?? idx }));
  } else {
    for (let i = 0; i < gridSize; i++) {
      const stream = streams.find(s => s.gridIndex === i) || null;
      cells.push({ stream, gridIndex: i });
    }
  }

  const cols = getColumnsForCount(cells.length);
  const rows = chunkIntoRows(cells, cols);
  const laidOut = rows.flatMap(row => 
    row.map(cell => ({ ...cell, rowSize: row.length }))
  );

  const handleRemove = (id: string, type: "stream" | "chat") => {
    const removed = streams.find((s) => s.id === id && s.type === type);
    onRemoveStream(id, type);
    
    if (removed?.platform === "kick" && type === "stream") {
      setKickRemountKey(k => k + 1);
    }
    
    // If it's a stream being removed, handle focus shifts
    if (type === "stream") {
      if (activeChatId === id) setActiveChatId(streams.find((s) => s.id !== id && (!s.type || s.type === "stream"))?.id || null);
      if (focusedId === id) {
        setFocusedId(streams.find((s) => s.id !== id && (!s.type || s.type === "stream"))?.id || null);
        setManuallyUnmuted(new Set());
      }
    }
  };

  const toggleManualMute = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setManuallyUnmuted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (streams.length === 0 && gridSize === "auto") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] p-2 flex items-center justify-center relative">
        <Empty className="p-8 border border-zinc-800 rounded-xl bg-zinc-950 max-w-md w-full mx-4 shadow-2xl">
          <EmptyMedia>
            <HugeiconsIcon icon={GridIcon} className="w-12 h-12 text-zinc-500" />
          </EmptyMedia>
          <EmptyTitle>No streams selected</EmptyTitle>
          <EmptyDescription>
            Pick a creator from the roster panel on the left to start building your ultimate viewing experience.
            Click a stream to give it audio — only one stream plays sound at a time.
          </EmptyDescription>
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-mono font-bold tracking-widest uppercase px-5 py-2.5 text-xs hover:bg-primary/90 transition-colors active:scale-[0.97]"
            >
              Take the tour
            </button>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex overflow-hidden bg-black relative">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-1">
        
        {/* Flat Grid Container */}
        <div className="absolute inset-1 flex flex-wrap content-stretch gap-1">
          <AnimatePresence mode="popLayout">
            {laidOut.map(({ stream, gridIndex, rowSize }) => {
              const style = { flexBasis: `calc(${100 / rowSize}% - 4px)` }; 
              
              const reactKey = stream ? `${stream.id}-${stream.type || 'stream'}` : `empty-${gridIndex}`;

              if (!stream) {
                return (
                  <SlotShell
                    key={reactKey}
                    gridIndex={gridIndex}
                    style={style}
                    className="relative min-w-0 min-h-0 grow-0 shrink-0 bg-transparent flex flex-col p-[1px]"
                  >
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded group hover:border-zinc-700 transition-colors border-dashed"
                    >
                      <button 
                        onClick={() => onAddStreamClick?.(gridIndex)}
                        className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:bg-zinc-800 transition-colors mb-4 text-3xl font-light text-zinc-500 group-hover:text-zinc-300 shadow-sm"
                      >
                        +
                      </button>
                      <span className="text-zinc-500 font-semibold group-hover:text-zinc-400 text-sm">Add Stream</span>
                      <span className="text-zinc-600 text-[10px] font-mono mt-1">or drag a creator here</span>
                    </div>
                  </SlotShell>
                );
              }

              if (stream.type === "chat") {
                return (
                  <SlotShell
                    key={reactKey}
                    gridIndex={gridIndex}
                    style={style}
                    className="relative min-w-0 min-h-0 grow-0 shrink-0 group bg-zinc-950 border border-zinc-800 rounded overflow-hidden flex flex-col"
                  >
                    {/* Drag handle: only the header bar initiates drag, not the chat iframe */}
                    <CellDragHandle stream={stream}>
                      <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
                        <HugeiconsIcon icon={Message01Icon} size={14} className="text-primary" />
                        <span className="text-white text-xs font-semibold truncate">
                          {stream.displayName || stream.channel} Chat
                        </span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemove(stream.id, "chat"); }}
                        title="Close Chat"
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </button>
                    </CellDragHandle>
                    <ChatBox 
                      platform={stream.platform} 
                      channel={stream.channel} 
                    />
                  </SlotShell>
                );
              }

              const isFocused = stream.id === focusedId;
              const isMuted = globalMuted || (!isFocused && !manuallyUnmuted.has(stream.id));
              const isKnownOffline =
                stream.platform !== "custom" &&
                liveMap !== undefined &&
                liveMap[stream.id] === false &&
                !forceMountIds?.[stream.id];

              if (isKnownOffline) {
                return (
                  <SlotShell
                    key={reactKey}
                    gridIndex={gridIndex}
                    style={style}
                    className="relative min-w-0 min-h-0 grow-0 shrink-0 group bg-zinc-950 border border-zinc-800 rounded overflow-hidden flex flex-col items-center justify-center gap-2 p-4 text-center"
                  >
                    <img
                      src={`https://avatar.vercel.sh/${stream.displayName || stream.channel}`}
                      alt=""
                      className="w-12 h-12 rounded-full bg-zinc-900 object-cover grayscale"
                    />
                    <div className="text-zinc-200 text-sm font-semibold truncate max-w-full">
                      {stream.displayName || stream.channel}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                      Offline
                    </div>
                    <div className="flex gap-2 mt-1">
                      {onRetryStream && (
                        <button
                          onClick={() => onRetryStream(stream.id)}
                          className="text-[11px] font-mono px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(stream.id, "stream"); }}
                        title="Close"
                        className="text-[11px] font-mono px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </SlotShell>
                );
              }

              const cellKey = `${reactKey}-r${remountKey}`;
              const focusCell = () => {
                setFocusedId(stream.id);
                setManuallyUnmuted(new Set()); // Prevent audio leak!
              };
              return (
                <SlotShell
                  key={cellKey}
                  gridIndex={gridIndex}
                  style={style}
                  className={`relative min-w-0 min-h-0 grow-0 shrink-0 group bg-zinc-900 border rounded overflow-hidden cursor-pointer transition-colors ${
                    isFocused ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] z-10" : "border-zinc-800"
                  }`}
                >
                  <StreamPlayer
                    stream={{
                      ...stream,
                      isPrimary: isFocused,
                      muted: isMuted
                    }}
                    kickRemountKey={kickRemountKey}
                    remountKey={remountKey}
                    twitchQuality={twitchQuality}
                  />

                  {/* Toolbar Overlay (Hover) — drag is initiated from here, NOT the cell wrapper.
                      This avoids the iframe swallowing drag events and makes dnd reliable. */}
                  <CellDragHandle stream={stream} onSelect={focusCell}>
                    <span className="text-white text-sm font-semibold truncate bg-black/50 px-2 py-1 rounded flex items-center gap-2">
                      {stream.displayName || stream.channel}
                      {!isMuted && stream.platform !== "custom" && (
                        <span className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                          Audio
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      {stream.platform !== "custom" && (
                        <button
                          onClick={(e) => toggleManualMute(e, stream.id)}
                          title={isMuted ? "Unmute" : "Mute"}
                          aria-label={isMuted ? `Unmute ${stream.displayName || stream.channel}` : `Mute ${stream.displayName || stream.channel}`}
                          aria-pressed={!isMuted}
                          className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                            !isMuted 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm'
                          }`}
                        >
                          {!isMuted ? <HugeiconsIcon icon={VolumeHighIcon} size={16} /> : <HugeiconsIcon icon={VolumeMute01Icon} size={16} />}
                        </button>
                      )}

                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveChatId(stream.id); }}
                          title="Chat"
                          className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                            activeChatId === stream.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm'
                          }`}
                        >
                          <HugeiconsIcon icon={Message01Icon} size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemove(stream.id, "stream"); }}
                        title="Close"
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </button>
                    </div>
                  </CellDragHandle>
                </SlotShell>
              );
            })}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
