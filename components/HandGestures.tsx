"use client";

import { useHandGestures } from "@/hooks/useHandGestures";

export default function HandGestures() {
  const { videoRef, canvasRef } = useHandGestures({
    onScrollUp: () => window.scrollBy({ top: -400, behavior: "smooth" }),
    onScrollDown: () => window.scrollBy({ top: 400, behavior: "smooth" }),
    onNextPage: () => window.history.forward(),
    onPrevPage: () => window.history.back(),
  });

  return (
    <div className="opacity-0">
      <video ref={videoRef} autoPlay playsInline style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </div>
  );
}
