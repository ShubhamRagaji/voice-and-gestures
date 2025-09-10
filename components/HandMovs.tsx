"use client";

import { useHandGestures } from "@/hooks/useHandGestures";

export default function HandMoves() {
  const { videoRef, canvasRef } = useHandGestures({
    onScrollUp: () => window.scrollBy({ top: -600, behavior: "smooth" }),
    onScrollDown: () => window.scrollBy({ top: 600, behavior: "smooth" }),
  });

  return (
    <>
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
    </>
  );
}
