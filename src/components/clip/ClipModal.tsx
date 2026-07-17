import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Id } from "@convex/_generated/dataModel";
import { WebCodecsCompositor } from "./WebCodecsCompositor";
import { HugeiconsIcon } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Loading01Icon from "@hugeicons/core-free-icons/Loading01Icon";
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon";
import Download01Icon from "@hugeicons/core-free-icons/Download01Icon";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BroadcasterData {
  broadcasterId: string;
  broadcasterName: string;
}

interface ClipModalProps {
  broadcasters: BroadcasterData[];
  onClose: () => void;
  isPro: boolean;
}

export function ClipModal({ broadcasters, onClose, isPro }: ClipModalProps) {
  const twitchToken = useQuery(api.twitchOAuth.getTwitchToken);
  const createClipJob = useMutation(api.clips.createClipJob);
  
  const [duration, setDuration] = useState<number>(30);
  const [removeWatermark, setRemoveWatermark] = useState<boolean>(false);
  const [layout, setLayout] = useState<string>("9:16-vertical");
  const [caption, setCaption] = useState<string>("");
  const [clipRecordId, setClipRecordId] = useState<Id<"clips"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clipStatus = useQuery(
    api.clips.getClipStatus, 
    clipRecordId ? { clipRecordId } : "skip"
  );

  const videoUrl = useQuery(
    api.clips.getClipVideoUrl,
    clipRecordId && clipStatus?.status === "ready" ? { clipRecordId } : "skip"
  );

  const handleClip = async () => {
    try {
      setError(null);
      const id = await createClipJob({
        broadcasters,
        duration,
        removeWatermark,
        layout: layout as any,
        caption: caption.trim() ? caption : undefined,
      });
      setClipRecordId(id);
    } catch (e: any) {
      setError(e.message || "Failed to create clip");
    }
  };

  const isConnected = twitchToken !== undefined && twitchToken !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#121212] border border-[#222] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222]">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <HugeiconsIcon icon={Tv01Icon} className="w-5 h-5 text-purple-500" />
            Clip Stream
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!isConnected ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
                <HugeiconsIcon icon={Tv01Icon} className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Twitch Connection Required</h3>
                <p className="text-sm text-gray-400">
                  To clip streams, you must connect your Twitch account. We require this to securely save clips to your account.
                </p>
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={() => window.location.href = "/api/twitch/connect"}>
                Connect Twitch
              </Button>
            </div>
          ) : !clipRecordId ? (
            <>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Target Streams</Label>
                  <div className="p-3 bg-black/50 rounded border border-[#333] text-white">
                    {broadcasters.map(b => b.broadcasterName).join(", ")}
                  </div>
                  {broadcasters.length > 1 && (
                    <p className="text-xs text-purple-400 mt-1">
                      Multi-POV clip activated!
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Duration (seconds)</Label>
                  <div className="flex gap-2">
                    {[15, 30].map(d => (
                      <Button
                        key={d}
                        variant={duration === d ? "default" : "outline"}
                        className={duration === d ? "bg-white text-black hover:bg-gray-200 flex-1" : "flex-1 border-[#333] text-gray-300 hover:text-white"}
                        onClick={() => setDuration(d)}
                      >
                        {d}s
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Layout</Label>
                  <Select value={layout} onValueChange={setLayout}>
                    <SelectTrigger className="w-full bg-black/50 border-[#333] text-white">
                      <SelectValue placeholder="Select Layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16-vertical">Full Screen (9:16 Vertical)</SelectItem>
                      {broadcasters.length > 1 && (
                        <>
                          <SelectItem value="split-screen">Split Screen (Top/Bottom)</SelectItem>
                          <SelectItem value="sequential-ranking">Sequential Ranking</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {layout !== "9:16-vertical" && (
                  <div className="space-y-2">
                    <Label className="text-gray-300">Caption Text (Optional)</Label>
                    <Input 
                      placeholder="e.g. Rate this setup 1-10!"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="bg-black/50 border-[#333] text-white placeholder:text-gray-600"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-black/30 border border-[#222] rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-gray-300">Remove Watermark</Label>
                    <p className="text-xs text-gray-500">Requires Pro subscription</p>
                  </div>
                  <Switch 
                    checked={removeWatermark}
                    onCheckedChange={setRemoveWatermark}
                    disabled={!isPro}
                  />
                </div>
              </div>

              <Button 
                className="w-full bg-white text-black hover:bg-gray-200 mt-4 font-semibold"
                onClick={handleClip}
              >
                Create Clip
              </Button>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              {clipStatus?.status === "creating" && (
                <>
                  <HugeiconsIcon icon={Loading01Icon} className="w-10 h-10 animate-spin text-purple-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-white font-medium">Creating Clip on Twitch...</p>
                    <p className="text-sm text-gray-400">Waiting for Twitch processing (approx 15s)</p>
                  </div>
                </>
              )}
              {clipStatus?.status === "downloading" && (
                <>
                  <HugeiconsIcon icon={Loading01Icon} className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-white font-medium">Downloading Media...</p>
                    <p className="text-sm text-gray-400">Fetching high-res MP4 from Twitch CDN</p>
                  </div>
                </>
              )}
              {clipStatus?.status === "ready" && videoUrl && (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <HugeiconsIcon icon={Download01Icon} className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-white font-medium">Clip Downloaded!</p>
                  <p className="text-sm text-gray-400">Rendering vertical format...</p>
                  
                  {/* Invisible compositor that triggers the auto-download once finished */}
                  <WebCodecsCompositor 
                    videoUrls={videoUrl}
                    removeWatermark={removeWatermark}
                    layout={clipStatus.layout as any}
                    caption={clipStatus.caption}
                  />
                </div>
              )}
              {clipStatus?.status === "failed" && (
                <>
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <HugeiconsIcon icon={Cancel01Icon} className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-white font-medium">Clipping Failed</p>
                  <p className="text-sm text-gray-400">Something went wrong during the workflow.</p>
                  <Button variant="outline" onClick={() => setClipRecordId(null)} className="mt-4">
                    Try Again
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
