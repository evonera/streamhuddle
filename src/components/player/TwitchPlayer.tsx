import { useEffect, useRef } from "react";
import { registerTwitchPlayer, unregisterTwitchPlayer } from "./twitch-registry";

// Module-level singleton to prevent duplicate script injection
let twitchScriptPromise: Promise<void> | null = null;

function loadTwitchScript(): Promise<void> {
  if (twitchScriptPromise) return twitchScriptPromise;
  
  if ((window as any).Twitch) {
    twitchScriptPromise = Promise.resolve();
    return twitchScriptPromise;
  }

  twitchScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  
  return twitchScriptPromise;
}

export function TwitchPlayer({
  channel,
  muted = false,
  streamId,
  remountKey,
  quality,
}: {
  channel: string;
  muted?: boolean;
  /** stable stream id for the global player registry (pause-all/quality) */
  streamId?: string;
  /** bump to force a full player re-init (reload-all) */
  remountKey?: number;
  /** explicit Twitch quality (e.g. "720p60"); undefined = embed default (Auto) */
  quality?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const mutedRef = useRef(muted);
  const qualityRef = useRef(quality);

  // Keep ref up to date for the initial constructor
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Channel names can come from share links. Keep untrusted values out of
    // HTML attributes and reject names the Twitch player cannot accept.
    if (!/^[a-zA-Z0-9_]{1,25}$/.test(channel)) {
      containerRef.current.replaceChildren();
      return;
    }

    const playerId = `twitch-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const container = containerRef.current;

    const playerHost = document.createElement("div");
    playerHost.id = playerId;
    playerHost.className = "w-full h-full";
    container.replaceChildren(playerHost);
    
    let mounted = true;

    const initPlayer = () => {
      if (!mounted || !containerRef.current) return;

      playerRef.current = new (window as any).Twitch.Player(playerId, {
        channel,
        parent: [window.location.hostname],
        muted: mutedRef.current, // Use freshest value at time of script load
        width: "100%",
        height: "100%"
      });
      if (streamId) registerTwitchPlayer(streamId, playerRef.current);
      // Apply an explicit quality override after init (embed default is Auto)
      if (qualityRef.current) {
        try {
          playerRef.current.setQuality(qualityRef.current);
        } catch {
          // unavailable quality falls back inside the embed
        }
      }
    };

    void loadTwitchScript().then(() => {
      if (mounted) initPlayer();
    }).catch((error: unknown) => {
      console.error("Unable to load Twitch player", error)
      if (mounted) container.replaceChildren()
    });

    return () => {
      mounted = false;
      if (streamId) unregisterTwitchPlayer(streamId, playerRef.current);
      container.replaceChildren();
      playerRef.current = null;
    };
  }, [channel, remountKey, streamId]);

  // The magic of the JS API: Change mute state without reloading the iframe!
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setMuted(muted);
    }
  }, [muted]);

  // Explicit quality override without reloading. Undefined = embed default (Auto).
  useEffect(() => {
    if (playerRef.current && quality) {
      try {
        playerRef.current.setQuality(quality);
      } catch {
        // ignore
      }
    }
  }, [quality]);

  return (
    <section className="w-full h-full bg-black relative" ref={containerRef} aria-label={`Twitch stream: ${channel}`}></section>
  );
}
