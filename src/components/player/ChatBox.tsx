import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

export function ChatBox({ 
  platform, 
  channel 
}: { 
  platform: "twitch" | "youtube" | "kick" | "custom"; 
  channel: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [isSystemDark, setIsSystemDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full bg-zinc-900 border-l border-zinc-800"></div>;
  }

  const parent = window.location.hostname;
  const isDark = theme === "dark" || (theme === "system" && isSystemDark);

  return (
    <div className="w-full h-full bg-background border-l border-border relative">
      {platform === "twitch" && (
        <iframe
          src={`https://www.twitch.tv/embed/${channel}/chat?parent=${parent}${isDark ? "&darkpopout" : ""}`}
          height="100%"
          width="100%"
          className="w-full h-full border-0 absolute inset-0"
        ></iframe>
      )}
      
      {platform === "youtube" && (
        <iframe
          src={`https://www.youtube.com/live_chat?v=${channel}&embed_domain=${parent}&dark_theme=${isDark ? "1" : "0"}`}
          height="100%"
          width="100%"
          className="w-full h-full border-0 absolute inset-0"
        ></iframe>
      )}

      {platform === "kick" && (
        <iframe
          src={`https://chat.kick.cx/${channel}`}
          height="100%"
          width="100%"
          className="w-full h-full border-0 absolute inset-0"
        ></iframe>
      )}

      {platform === "custom" && (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          Chat not supported for custom streams
        </div>
      )}
    </div>
  );
}
