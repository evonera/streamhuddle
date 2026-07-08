import { useEffect, useRef } from "react";

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
  muted = false 
}: { 
  channel: string; 
  muted?: boolean 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const mutedRef = useRef(muted);

  // Keep ref up to date for the initial constructor
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const playerId = `twitch-${channel}-${Math.random().toString(36).substring(7)}`;
    const container = containerRef.current;
    
    container.innerHTML = `<div id="${playerId}" class="w-full h-full"></div>`;
    
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
    };

    loadTwitchScript().then(() => {
      if (mounted) initPlayer();
    });

    return () => {
      mounted = false;
      if (container) container.innerHTML = '';
      playerRef.current = null;
    };
  }, [channel]);

  // The magic of the JS API: Change mute state without reloading the iframe!
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setMuted(muted);
    }
  }, [muted]);

  return (
    <div className="w-full h-full bg-black relative" ref={containerRef}></div>
  );
}
