import { useEffect, useRef, useState } from "react";
import { registerTwitchPlayer, unregisterTwitchPlayer } from "./twitch-registry";

import { getTwitchApi, loadTwitchScript } from "./twitch-script";
import type { TwitchEmbedPlayer } from "./twitch-script";

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
  const playerRef = useRef<TwitchEmbedPlayer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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

    setLoadError(null);

    // Channel names can come from share links. Keep untrusted values out of
    // HTML attributes and reject names the Twitch player cannot accept.
    if (!/^[a-zA-Z0-9_]{1,25}$/.test(channel)) {
      containerRef.current.replaceChildren();
      setLoadError("This Twitch channel name is invalid.");
      return;
    }

    const playerId = `twitch-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const container = containerRef.current;

    const playerHost = document.createElement("div");
    playerHost.id = playerId;
    playerHost.className = "w-full h-full";
    container.replaceChildren(playerHost);
    
    let mounted = true;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let initializedPlayer: TwitchEmbedPlayer | undefined;

    const initPlayer = () => {
      if (!mounted || !containerRef.current) return;

      const twitch = getTwitchApi();
      if (!twitch) throw new Error("Twitch embed API is unavailable");
      const player = new twitch.Player(playerId, {
        channel,
        parent: [window.location.hostname],
        muted: mutedRef.current, // Use freshest value at time of script load
        width: "100%",
        height: "100%"
      });
      initializedPlayer = player;
      playerRef.current = player;
      readyTimer = setTimeout(() => {
        if (mounted) {
          setLoadError("Twitch is taking too long to load. Try again or watch on Twitch.");
          if (streamId) unregisterTwitchPlayer(streamId, player);
          container.replaceChildren();
          playerRef.current = null;
        }
      }, 15_000);
      player.addEventListener(twitch.Player.READY, () => {
        if (!mounted || playerRef.current !== player) return;
        clearTimeout(readyTimer);
        if (streamId) registerTwitchPlayer(streamId, player);
        try {
          player.setMuted(mutedRef.current);
          if (qualityRef.current) player.setQuality(qualityRef.current);
        } catch { /* settings fall back inside the embed */ }
      });
    };

    void loadTwitchScript().then(() => {
      if (mounted) initPlayer();
    }).catch((error: unknown) => {
      console.error("Unable to load Twitch player", error);
      if (mounted) {
        clearTimeout(readyTimer);
        if (streamId && initializedPlayer) unregisterTwitchPlayer(streamId, initializedPlayer);
        playerRef.current = null;
        container.replaceChildren();
        setLoadError("Unable to load Twitch. Check your connection and try again.");
      }
    });

    return () => {
      mounted = false;
      clearTimeout(readyTimer);
      if (streamId && initializedPlayer) unregisterTwitchPlayer(streamId, initializedPlayer);
      container.replaceChildren();
      playerRef.current = null;
    };
  }, [channel, remountKey, streamId, attempt]);

  // The magic of the JS API: Change mute state without reloading the iframe!
  useEffect(() => {
    if (playerRef.current) {
      try { playerRef.current.setMuted(muted); } catch { /* player is still initializing */ }
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
    <section className="w-full h-full bg-black relative" aria-label={`Twitch stream: ${channel}`}>
      <div className="w-full h-full" ref={containerRef} />
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-4 text-center text-foreground">
          <p role="alert" className="text-sm text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring">Retry</button>
          {/^[a-zA-Z0-9_]{1,25}$/.test(channel) && (
            <a href={`https://www.twitch.tv/${encodeURIComponent(channel)}`} target="_blank" rel="noreferrer" className="text-sm underline">Watch on Twitch</a>
          )}
        </div>
      )}
    </section>
  );
}
