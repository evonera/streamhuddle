import { useState, useEffect } from "react";

export function ChatBox({ 
  platform, 
  channel 
}: { 
  platform: "twitch" | "youtube" | "kick" | "custom"; 
  channel: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full bg-zinc-900 border-l border-zinc-800"></div>;
  }

  const parent = window.location.hostname;


  return (
    <div className="w-full h-full bg-zinc-900 border-l border-zinc-800">
      {platform === "twitch" && (
        <iframe
          src={`https://www.twitch.tv/embed/${channel}/chat?parent=${parent}&darkpopout`}
          height="100%"
          width="100%"
          className="w-full h-full border-0"
        ></iframe>
      )}
      
      {platform === "youtube" && (
        <iframe
          src={`https://www.youtube.com/live_chat?v=${channel}&embed_domain=${parent}&dark_theme=1`}
          height="100%"
          width="100%"
          className="w-full h-full border-0"
        ></iframe>
      )}

      {platform === "kick" && (
        <iframe
          src={`https://chat.kick.cx/${channel}`}
          height="100%"
          width="100%"
          className="w-full h-full border-0"
        ></iframe>
      )}

      {platform === "custom" && (
        <div className="w-full h-full flex items-center justify-center text-zinc-500">
          Chat not supported for custom streams
        </div>
      )}
    </div>
  );
}
