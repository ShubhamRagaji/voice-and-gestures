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

  const { videoRef, canvasRef } = useHandGestures({
    scrollUpAmount,
    scrollDownAmount,
    onNextPage: onNextPage,
    onPrevPage: onPrevPage,
  });

  useEffect(() => {
    setshowHandLandMarkModel(showHandGestures);
  }, [onNextPage, onPrevPage]);

  return (
    <div className={showHandLandMarkModel ? "block" : "hidden"}>
      <video ref={videoRef} autoPlay playsInline style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        width={window?.innerWidth}
        height={window?.innerHeight}
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
