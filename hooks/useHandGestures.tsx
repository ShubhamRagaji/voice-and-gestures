"use client";
import { useEffect, useRef } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type GestureCallbacks = {
  onScrollUp?: () => void;
  onScrollDown?: () => void;
};

export function useHandGestures({
  onScrollUp,
  onScrollDown,
}: GestureCallbacks) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const initializedRef = useRef(false);

  const lastYRef = useRef<number | null>(null);
  const modeRef = useRef<"none" | "up" | "down">("none"); // lock mode
  const lastActionRef = useRef<number>(0);

  useEffect(() => {
    let animationId: number;

    async function init() {
      if (initializedRef.current) return;
      initializedRef.current = true;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 1,
        }
      );

      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;

        videoRef.current.onloadeddata = () => {
          loop();
        };
      }
    }

    async function loop() {
      if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current)
        return;

      const results = await handLandmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const ctx = canvasRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const drawingUtils = new DrawingUtils(ctx);

        drawingUtils.drawConnectors(
          landmarks,
          HandLandmarker.HAND_CONNECTIONS,
          { color: "lime", lineWidth: 2 }
        );
        drawingUtils.drawLandmarks(landmarks, { color: "red", radius: 4 });

        detectScroll(landmarks);
      }

      animationId = requestAnimationFrame(loop);
    }

    function detectScroll(landmarks: any) {
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const indexMCP = landmarks[5];
      const middleMCP = landmarks[9];

      // Detect finger extension
      const isIndexExtended = indexTip.y < indexMCP.y;
      const isMiddleExtended = middleTip.y < middleMCP.y;

      // Compute average Y of extended fingers
      let avgY = null;
      if (isIndexExtended && isMiddleExtended)
        avgY = (indexTip.y + middleTip.y) / 2;
      else if (isIndexExtended) avgY = indexTip.y;
      else {
        modeRef.current = "none";
        lastYRef.current = null;
        return;
      }

      // Set mode
      if (isIndexExtended && isMiddleExtended)
        modeRef.current = "down"; // both → scroll down
      else if (isIndexExtended) modeRef.current = "up"; // only index → scroll up

      const lastY = lastYRef.current;
      const now = Date.now();
      const cooldown = 500; // ms
      const threshold = 0.03; // movement threshold

      if (lastY !== null) {
        const deltaY = avgY - lastY;

        // Reverse logic: scroll opposite to hand movement
        if (
          modeRef.current === "down" &&
          deltaY < -threshold &&
          now - lastActionRef.current > cooldown
        ) {
          onScrollDown?.();
          lastActionRef.current = now;
        }

        if (
          modeRef.current === "up" &&
          deltaY > threshold &&
          now - lastActionRef.current > cooldown
        ) {
          onScrollUp?.();
          lastActionRef.current = now;
        }
      }

      lastYRef.current = avgY;
    }

    init();

    return () => cancelAnimationFrame(animationId);
  }, [onScrollUp, onScrollDown]);

  return { videoRef, canvasRef };
}
