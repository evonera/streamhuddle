import { useState, useEffect } from "react";
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
  onSwapStream
}: { 
  streams: StreamData[];
  gridSize?: "auto" | number;
  onRemoveStream: (id: string, type: "stream" | "chat") => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddStreamClick?: () => void;
  onSwapStream?: (draggedId: string, draggedType: "stream" | "chat", targetGridIndex: number) => void;
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
            Click the "Browse Roster" button to explore live creators and start building your ultimate viewing experience.
          </EmptyDescription>
          <button 
            onClick={onAddStreamClick}
            className="mt-6 w-full bg-primary/90 hover:bg-primary text-primary-foreground font-semibold py-2 px-4 rounded transition-colors"
          >
            Browse Roster
          </button>
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

              const dropProps = {
                onDragOver: ((e: React.DragEvent) => e.preventDefault()) as any,
                onDrop: ((e: React.DragEvent) => {
                  e.preventDefault();
                  const dragId = e.dataTransfer.getData("application/x-stream-id");
                  const dragType = e.dataTransfer.getData("application/x-stream-type");
                  if (dragId && onSwapStream) {
                    onSwapStream(dragId, dragType as any, gridIndex);
                  }
                }) as any
              };

              const dragProps = {
                ...dropProps,
                draggable: true,
                onDragStart: ((e: React.DragEvent) => {
                  if (stream) {
                    e.dataTransfer.setData("application/x-stream-id", stream.id);
                    e.dataTransfer.setData("application/x-stream-type", stream.type || "stream");
                  }
                }) as any
              };

              if (!stream) {
                return (
                  <motion.div
                    layout
                    key={reactKey}
                    style={style}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="relative min-w-0 min-h-0 grow-0 shrink-0 bg-transparent flex flex-col p-[1px]"
                    {...dropProps}
                  >
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded group hover:border-zinc-700 transition-colors border-dashed"
                    >
                      <button 
                        onClick={onAddStreamClick}
                        className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:bg-zinc-800 transition-colors mb-4 text-3xl font-light text-zinc-500 group-hover:text-zinc-300 shadow-sm"
                      >
                        +
                      </button>
                      <span className="text-zinc-500 font-semibold group-hover:text-zinc-400 text-sm">Add Stream</span>
                    </div>
                  </motion.div>
                );
              }

              if (stream.type === "chat") {
                return (
                  <motion.div
                    layout
                    key={reactKey}
                    style={style}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="relative min-w-0 min-h-0 grow-0 shrink-0 group bg-zinc-950 border border-zinc-800 rounded overflow-hidden flex flex-col"
                    {...dragProps}
                  >
                    <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center z-50 cursor-grab active:cursor-grabbing">
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
                    </div>
                    <ChatBox 
                      platform={stream.platform} 
                      channel={stream.channel} 
                    />
                  </motion.div>
                );
              }

              const isFocused = stream.id === focusedId;
              const isMuted = !isFocused && !manuallyUnmuted.has(stream.id);
              
              return (
                <motion.div
                  layout
                  key={reactKey}
                  style={style}
                  onClick={() => {
                    setFocusedId(stream.id);
                    setManuallyUnmuted(new Set()); // Prevent audio leak!
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className={`relative min-w-0 min-h-0 grow-0 shrink-0 group bg-zinc-900 border rounded overflow-hidden cursor-pointer transition-colors ${
                    isFocused ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] z-10" : "border-zinc-800"
                  }`}
                  {...dragProps}
                >
                  <StreamPlayer 
                    stream={{
                      ...stream,
                      isPrimary: isFocused,
                      muted: isMuted
                    }} 
                    kickRemountKey={kickRemountKey}
                  />
                  
                  {/* Toolbar Overlay (Hover) */}
                  <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center z-50 cursor-grab active:cursor-grabbing">
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
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
