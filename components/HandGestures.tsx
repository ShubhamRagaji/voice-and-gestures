"use client";

import { useHandGestures } from "@/hooks/useHandGestures";
import { useEffect, useState } from "react";

type HandGesturesProps = {
  scrollUpAmount?: number;
  scrollDownAmount?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  showHandGestures?: boolean;
};

export default function HandGestures({
  scrollUpAmount,
  scrollDownAmount,
  onNextPage,
  onPrevPage,
  showHandGestures = false,
}: HandGesturesProps) {
  const [showHandLandMarkModel, setshowHandLandMarkModel] =
    useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const { videoRef, canvasRef } = useHandGestures({
    scrollUpAmount,
    scrollDownAmount,
    onNextPage: onNextPage,
    onPrevPage: onPrevPage,
  });

  useEffect(() => {
    setshowHandLandMarkModel(showHandGestures);

    // restore the scroll position
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, [showHandGestures]);

  useEffect(() => {
    setCanvasSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  return (
    <div className={showHandLandMarkModel ? "block" : "hidden"}>
      <video ref={videoRef} autoPlay playsInline style={{ display: "none" }} />
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
  );
}
