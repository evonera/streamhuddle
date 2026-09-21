import { TwitchPlayer } from "./TwitchPlayer";
import { YouTubePlayer } from "./YouTubePlayer";
import { KickPlayer } from "./KickPlayer";

export type StreamPlatform = "twitch" | "youtube" | "kick" | "custom";

export interface StreamData {
  id: string; // unique ID for this instance in the grid
  platform: StreamPlatform;
  channel: string; // username or videoId or custom URL
  displayName?: string; // used for custom URLs
  isPrimary?: boolean; // For YouTube click-to-play
  muted?: boolean;
  type?: "stream" | "chat"; // For in-grid chat
  gridIndex?: number; // Tracks position in fixed grid layouts
}

export function StreamPlayer({ stream, kickRemountKey, remountKey, twitchQuality }: { stream: StreamData; kickRemountKey?: number; remountKey?: number; twitchQuality?: string }) {
  switch (stream.platform) {
    case "twitch":
      return <TwitchPlayer channel={stream.channel} muted={stream.muted} streamId={stream.id} remountKey={remountKey ?? kickRemountKey} quality={twitchQuality} />;
    case "youtube":
      return (
        <YouTubePlayer
          videoId={stream.channel}
          isPrimary={stream.isPrimary}
          muted={stream.muted}
          title={stream.displayName || stream.channel}
          remountKey={remountKey}
        />
      );
    case "kick":
      return <KickPlayer channel={stream.channel} muted={stream.muted} remountKey={remountKey ?? kickRemountKey} title={stream.displayName || stream.channel} />;
    case "custom": {
      // Prevent XSS from javascript: URLs
      let safeUrl = "";
      try {
        const parsed = new URL(stream.channel);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          safeUrl = stream.channel;
        }
      } catch (e) {
        // Invalid URL
      }
      
      if (!safeUrl) return <div className="w-full h-full bg-black text-red-500 flex items-center justify-center text-xs p-4 text-center">Invalid custom stream URL</div>;

      return (
        <iframe
          src={safeUrl}
          className="w-full h-full bg-black pointer-events-auto"
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          title={stream.displayName || "Custom Stream"}
        />
      );
    }
    default:
      return null;
  }
}
