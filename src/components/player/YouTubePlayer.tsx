import { useState } from "react";

export function YouTubePlayer({ 
  videoId, 
  isPrimary = false,
  muted = true
}: { 
  videoId: string; 
  isPrimary?: boolean;
  muted?: boolean;
}) {
  const [hasClickedPlay, setHasClickedPlay] = useState(false);

  const shouldAutoplay = isPrimary || hasClickedPlay;

  // If it's not primary and user hasn't clicked, show a "Click to Play" overlay.
  // This bypasses YouTube's strict 1-autoplay per page limit.
  if (!shouldAutoplay) {
    return (
      <div 
        className="w-full h-full relative group cursor-pointer bg-black overflow-hidden flex items-center justify-center"
        onClick={() => setHasClickedPlay(true)}
      >
        <img 
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
          alt="YouTube Stream Thumbnail"
          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-300"
        />
        <div className="z-10 bg-black/60 p-4 rounded-full backdrop-blur-sm shadow-xl group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-primary-foreground">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div className="absolute bottom-4 left-4 z-10 bg-black/80 text-white px-3 py-1 rounded text-sm font-semibold tracking-wide uppercase">
          Click to Play
        </div>
      </div>
    );
  }

  // Once active or if primary, render the actual iframe
  return (
    <div className="w-full h-full bg-black">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1`}
        height="100%"
        width="100%"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      ></iframe>
    </div>
  );
}
