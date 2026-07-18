import { useEffect, useRef, useState } from "react";

interface WebCodecsCompositorProps {
  videoUrls: string[];
  removeWatermark: boolean;
  layout?: "9:16-vertical" | "split-screen" | "sequential-ranking";
  caption?: string;
}

export function WebCodecsCompositor({ videoUrls, removeWatermark, layout = "9:16-vertical", caption }: WebCodecsCompositorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    if (!videoUrls || videoUrls.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 9:16 aspect ratio
    canvas.width = 1080;
    canvas.height = 1920;

    let mediaRecorder: MediaRecorder;
    const chunks: Blob[] = [];
    let animationFrameId: number;

    const watermarkImg = new Image();
    
    // Create video elements dynamically
    const videos = videoUrls.map(url => {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous";
        v.muted = true;
        v.playsInline = true;
        v.src = url;
        return v;
    });

    let currentVideoIndex = 0; // For sequential layout
    
    const drawFrame = () => {
      // Background base
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (layout === "split-screen" && videos.length >= 2) {
          const topVideo = videos[0];
          const bottomVideo = videos[1];

          if (!topVideo.paused && !topVideo.ended) {
              const h = canvas.height / 2;
              const scale = canvas.width / topVideo.videoWidth;
              const w = canvas.width;
              const dh = topVideo.videoHeight * scale;
              const dy = (h - dh) / 2;
              
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, canvas.width, h);
              ctx.clip();
              ctx.drawImage(topVideo, 0, dy, w, dh);
              ctx.restore();
          }
          if (!bottomVideo.paused && !bottomVideo.ended) {
              const h = canvas.height / 2;
              const scale = canvas.width / bottomVideo.videoWidth;
              const w = canvas.width;
              const dh = bottomVideo.videoHeight * scale;
              const dy = h + (h - dh) / 2;
              
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, h, canvas.width, h);
              ctx.clip();
              ctx.drawImage(bottomVideo, 0, dy, w, dh);
              ctx.restore();
          }
          
          // Draw dividing line
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);

      } else {
          // 9:16 vertical or sequential ranking (they both render one video at a time)
          const activeVideo = layout === "sequential-ranking" ? videos[currentVideoIndex] : videos[0];
          
          if (activeVideo && !activeVideo.paused && !activeVideo.ended) {
            // Blurred background
            ctx.filter = "blur(20px) brightness(0.5)";
            const bgScale = Math.max(canvas.width / activeVideo.videoWidth, canvas.height / activeVideo.videoHeight);
            const bgW = activeVideo.videoWidth * bgScale;
            const bgH = activeVideo.videoHeight * bgScale;
            ctx.drawImage(activeVideo, (canvas.width - bgW) / 2, (canvas.height - bgH) / 2, bgW, bgH);

            // Main video
            ctx.filter = "none";
            const mainScale = canvas.width / activeVideo.videoWidth;
            const mainH = activeVideo.videoHeight * mainScale;
            ctx.drawImage(activeVideo, 0, (canvas.height - mainH) / 2, canvas.width, mainH);
          }
      }

      // Draw Caption (Hormozi style)
      if (caption) {
        ctx.textAlign = "center";
        
        // Draw background box for text
        ctx.font = "bold 80px Montserrat, Inter, sans-serif";
        
        // The Y position changes based on layout
        let textY = layout === "split-screen" ? canvas.height / 2 : canvas.height / 2 - 400;
        
        ctx.fillStyle = "#FFDD00"; // Hormozi yellow
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        // Draw text stroke for popping effect
        ctx.lineWidth = 12;
        ctx.strokeStyle = "black";
        ctx.strokeText(caption, canvas.width / 2, textY);
        
        // Fill text
        ctx.fillText(caption, canvas.width / 2, textY);
        
        // Reset shadow
        ctx.shadowColor = "transparent";
      }

      // Draw Watermark
      if (!removeWatermark) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(watermarkImg, canvas.width - 220, canvas.height - 80, 200, 50);
        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(drawFrame);
    };

    const startRecording = () => {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/mp4") 
        ? "video/mp4" 
        : "video/webm;codecs=vp9";
        
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `streamhuddle_clip_${Date.now()}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setIsProcessing(false);
      };
      mediaRecorder.start();
      drawFrame();
    };

    const playVideoSequentially = (index: number) => {
        if (index >= videos.length) {
            mediaRecorder.stop();
            return;
        }
        currentVideoIndex = index;
        const v = videos[index];
        v.play();
        v.onended = () => playVideoSequentially(index + 1);
    };

    const playVideos = () => {
      startRecording();
      
      if (layout === "split-screen") {
          // Play first two videos simultaneously
          videos[0]?.play();
          videos[1]?.play();
          
          // Stop recording when the longest one ends
          let endedCount = 0;
          const onVideoEnd = () => {
              endedCount++;
              if (endedCount === Math.min(2, videos.length)) {
                  mediaRecorder.stop();
              }
          };
          if (videos[0]) videos[0].onended = onVideoEnd;
          if (videos[1]) videos[1].onended = onVideoEnd;
      } else if (layout === "sequential-ranking") {
          playVideoSequentially(0);
      } else {
          // Default 9:16
          videos[0]?.play();
          if (videos[0]) videos[0].onended = () => mediaRecorder.stop();
      }
    };

    if (removeWatermark) {
      playVideos();
    } else {
      watermarkImg.onload = playVideos;
      watermarkImg.src = "/watermark.svg";
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      videos.forEach(v => { v.pause(); v.src = ""; });
    };
  }, [videoUrls, removeWatermark, layout, caption]);

  if (!isProcessing) {
      return <div className="text-sm text-green-400 mt-2 font-medium">Export complete! Check your downloads.</div>;
  }

  return (
    <div className="hidden" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
