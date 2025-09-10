"use client";
import { useHandGestures } from "@/hooks/useHandGestures";

export default function HandsDemo() {
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

      <div className="h-[100vh] bg-gray-700">sdsd</div>
      <div className="h-[100vh] bg-gray-800">sdsd</div>
      <div className="h-[100vh] bg-gray-900">sdsd</div>
      <div className="h-[100vh] bg-gray-950">sdsd</div>
    </>
  );
}
