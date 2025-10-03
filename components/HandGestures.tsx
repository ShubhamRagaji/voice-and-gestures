"use client";

import { useHandGestures } from "@/hooks/useHandGestures";
import React, { useEffect, useState } from "react";

type HandGesturesProps = {
  scrollUpAmount?: number;
  scrollDownAmount?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  fistHoldTime?: number;
  cursorSensitivity?: number;
};

export default function HandGestures({
  scrollUpAmount,
  scrollDownAmount,
  onNextPage,
  onPrevPage,
  cursorSensitivity,
  fistHoldTime,
}: HandGesturesProps) {
  useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const { videoRef, canvasRef } = useHandGestures({
    scrollUpAmount,
    scrollDownAmount,
    onNextPage: onNextPage,
    onPrevPage: onPrevPage,
    cursorSensitivity: cursorSensitivity,
    fistHoldTime: fistHoldTime,
  });

  useEffect(() => {
    setCanvasSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  return (
    <>
      <div style={{ opacity: 0 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ display: "none" }}
        />
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
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

      {/* Custom Cursor */}
      <div
        id="custom-cursor"
        className="fixed w-4 h-4 bg-[rgba(0,0,0,0.8)] border-2 border-white rounded-full pointer-events-none z-[10000] hidden shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-opacity duration-200 ease-in-out"
      />
    </>
  );
}
