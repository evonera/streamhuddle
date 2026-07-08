import { useState, useEffect } from "react";
import { StreamPlayer, type StreamData } from "./StreamPlayer";
import { ChatBox } from "./ChatBox";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Volume2, VolumeX, X, Grid } from "lucide-react";
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
  onRemoveStream,
  activeChatId,
  setActiveChatId,
  onAddStreamClick
}: { 
  streams: StreamData[];
  onRemoveStream: (id: string, type: "stream" | "chat") => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddStreamClick?: () => void;
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



  const laidOut = chunkIntoRows(
    streams.map((stream) => ({ stream, rowSize: getColumnsForCount(streams.length) })),
    getColumnsForCount(streams.length)
  ).flatMap(row => row);

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

  if (streams.length === 0) {
    return (
      <div className="w-full h-full bg-[#0a0a0a] p-2 flex items-center justify-center relative">
        <Empty className="p-8 border border-zinc-800 rounded-xl bg-zinc-950 max-w-md w-full mx-4 shadow-2xl">
          <EmptyMedia>
            <Grid className="w-12 h-12 text-zinc-500" />
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
            {laidOut.map(({ stream, rowSize }, idx) => {
              const style = { flexBasis: `calc(${100 / rowSize}% - 4px)` }; 
              
              // Unique key for the array map
              const reactKey = `${stream.id}-${stream.type || 'stream'}-${idx}`;

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
                  >
                    <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center z-50">
                      <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
                        <MessageSquare size={14} className="text-primary" />
                        <span className="text-white text-xs font-semibold truncate">
                          {stream.displayName || stream.channel} Chat
                        </span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemove(stream.id, "chat"); }}
                        title="Close Chat"
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
                      >
                        <X size={16} />
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
              
              // Always use stream.id to preserve FLIP animation for Kick!
              const streamKey = stream.id;

              return (
                <motion.div
                  layout
                  key={streamKey}
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
                >
                  <StreamPlayer 
                    stream={{
                      ...stream,
                      isPrimary: isFocused,
                      muted: isMuted
                    }} 
                    kickRemountKey={kickRemountKey} // Pass down remount key so it doesn't break motion.div!
                  />
                  
                  {/* Toolbar Overlay (Hover) */}
                  <div className="absolute top-0 left-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center z-50">
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
                          {!isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
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
                          <MessageSquare size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemove(stream.id, "stream"); }}
                        title="Close"
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
                      >
                        <X size={16} />
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
