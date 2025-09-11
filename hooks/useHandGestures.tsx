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
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function useHandGestures({
  onScrollUp,
  onScrollDown,
  onNextPage,
  onPrevPage,
}: GestureCallbacks) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const initializedRef = useRef(false);

  const lastYRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const lastActionRef = useRef<number>(0);

  const historyYRef = useRef<number[]>([]);
  const historyXRef = useRef<number[]>([]);
  const HISTORY_MAX = 5;
  const COOLDOWN = 500;

  function pushHistory(hist: number[], value: number) {
    hist.push(value);
    if (hist.length > HISTORY_MAX) hist.shift();
  }

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

      if (!videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => loop();
    }

    async function loop() {
      if (
        !handLandmarkerRef.current ||
        !videoRef.current ||
        !canvasRef.current
      ) {
        animationId = requestAnimationFrame(loop);
        return;
      }

      const results = await handLandmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const ctx = canvasRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, {
          color: "lime",
          lineWidth: 2,
        });
        drawingUtils.drawLandmarks(lm, { color: "red", radius: 4 });

        processGestures(lm);
      }

      animationId = requestAnimationFrame(loop);
    }

    // 👇 Decide gesture type
    function processGestures(lm: any) {
      const indexTip = lm[8];
      const middleTip = lm[12];
      const ringTip = lm[16];
      const pinkyTip = lm[20];

      const indexMCP = lm[5];
      const middleMCP = lm[9];

      const isIndexUp = indexTip.y < indexMCP.y;
      const isMiddleUp = middleTip.y < middleMCP.y;
      const isRingUp = ringTip.y < lm[13].y;
      const isPinkyUp = pinkyTip.y < lm[17].y;

      if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        // ☝ One finger → Scroll up
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: false });
      } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        // ✌ Two fingers → Scroll down
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: true });
      } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        // 🖐 Four fingers → Horizontal swipe
        handleHorizontalSwipe(lm);
      } else {
        // Reset states when gesture doesn’t match
        lastYRef.current = null;
        lastXRef.current = null;
        historyYRef.current = [];
        historyXRef.current = [];
      }
    }

    function handleVerticalScroll(
      lm: any,
      { isIndexUp, isMiddleUp }: { isIndexUp: boolean; isMiddleUp: boolean }
    ) {
      const indexTip = lm[8];
      const middleTip = lm[12];

      let avgY: number | null = null;
      if (isIndexUp && isMiddleUp) avgY = (indexTip.y + middleTip.y) / 2;
      else if (isIndexUp) avgY = indexTip.y;

      if (avgY === null) {
        lastYRef.current = null;
        historyYRef.current = [];
        return;
      }

      pushHistory(historyYRef.current, avgY);

      const lastY = lastYRef.current;
      const now = Date.now();
      const threshold = 0.02;

      if (lastY !== null && now - lastActionRef.current > COOLDOWN) {
        const deltaY = avgY - lastY;

        if (isIndexUp && isMiddleUp && deltaY < -threshold) {
          // Two-finger scroll down
          onScrollDown?.();
          lastActionRef.current = now;
          historyYRef.current = [];
        } else if (isIndexUp && !isMiddleUp && deltaY > threshold) {
          // One-finger scroll up
          onScrollUp?.();
          lastActionRef.current = now;
          historyYRef.current = [];
        }
      }

      lastYRef.current = avgY;
    }

    function handleHorizontalSwipe(lm: any) {
      const indexTip = lm[8];
      const xNorm = 1 - indexTip.x;

      pushHistory(historyXRef.current, xNorm);

      const lastPos = lastXRef.current;
      const now = Date.now();
      const horizontalThreshold = 0.25;

      if (lastPos !== null && now - lastActionRef.current > COOLDOWN) {
        const dx = xNorm - lastPos;

        if (Math.abs(dx) > horizontalThreshold) {
          if (dx > 0) {
            onPrevPage?.();
          } else {
            onNextPage?.();
          }
          lastActionRef.current = now;
          historyXRef.current = [];
        }
      }

      lastXRef.current = xNorm;
    }

    init();

    return () => cancelAnimationFrame(animationId);
  }, [onScrollUp, onScrollDown, onNextPage, onPrevPage]);

  return { videoRef, canvasRef };
}