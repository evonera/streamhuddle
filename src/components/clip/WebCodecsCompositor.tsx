import { useEffect, useRef, useState } from "react";
// In a real implementation, mediabunny would be used for robust WebCodecs MP4 muxing.
// For this MVP, we use a hidden video element + canvas + MediaRecorder to export a WebM/MP4,
// which avoids complex frame demuxing logic while still running entirely client-side.

export function WebCodecsCompositor({ videoUrl, removeWatermark }: { videoUrl: string, removeWatermark: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 9:16 aspect ratio (e.g., 1080x1920)
    canvas.width = 1080;
    canvas.height = 1920;

    let mediaRecorder: MediaRecorder;
    const chunks: Blob[] = [];
    let animationFrameId: number;

    const watermarkImg = new Image();

    const drawFrame = () => {
      if (video.paused || video.ended) return;

      // 1. Draw blurred background (center crop of the 16:9)
      ctx.filter = "blur(20px) brightness(0.5)";
      // The video is 16:9, we draw it stretched/zoomed to fill 9:16
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(video, x, y, w, h);

      // 2. Draw the main video in the center (unblurred, 16:9 fitted inside 9:16)
      ctx.filter = "none";
      const mainScale = canvas.width / video.videoWidth;
      const mainW = canvas.width;
      const mainH = video.videoHeight * mainScale;
      const mainY = (canvas.height - mainH) / 2;
      ctx.drawImage(video, 0, mainY, mainW, mainH);

      // 3. Draw Watermark
      if (!removeWatermark) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(watermarkImg, canvas.width - 220, canvas.height - 80, 200, 50);
        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(drawFrame);
    };

    video.onplay = () => {
      // Start recording the canvas stream
      const stream = canvas.captureStream(30); // 30 fps
      // Try mp4 first, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("video/mp4") 
        ? "video/mp4" 
        : "video/webm;codecs=vp9";
        
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
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

    video.onended = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      cancelAnimationFrame(animationFrameId);
    };

    const startVideo = () => {
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.play().catch(e => {
          console.error("Auto-play failed, might need user interaction", e);
          setIsProcessing(false);
      });
    };

    if (removeWatermark) {
      startVideo();
    } else {
      watermarkImg.onload = startVideo;
      // Set src after onload to prevent race conditions with cached images
      watermarkImg.src = "/watermark.svg";
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [videoUrl, removeWatermark]);

  if (!isProcessing) {
      return <div className="text-sm text-green-400 mt-2">Export complete! Check your downloads.</div>;
  }

  return (
    <div className="hidden">
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
    </div>
  );
}
