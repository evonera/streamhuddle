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
}

export function StreamPlayer({ stream, kickRemountKey }: { stream: StreamData; kickRemountKey?: number }) {
  switch (stream.platform) {
    case "twitch":
      return <TwitchPlayer channel={stream.channel} muted={stream.muted} />;
    case "youtube":
      return (
        <YouTubePlayer 
          videoId={stream.channel} 
          isPrimary={stream.isPrimary} 
          muted={stream.muted} 
        />
      );
    case "kick":
      return <KickPlayer channel={stream.channel} muted={stream.muted} remountKey={kickRemountKey} />;
    case "custom":
      return (
        <iframe
          src={stream.channel}
          className="w-full h-full bg-black pointer-events-auto"
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          title={stream.displayName || "Custom Stream"}
        />
      );
    default:
      return null;
  }
}
