"use client"; 
// Required in Next.js App Router so this hook runs on the client (browser), not server.

import { useEffect, useRef } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
// 👆 These are from Mediapipe Tasks Vision:
// - HandLandmarker → detects hand landmarks (21 points per hand).
// - FilesetResolver → loads WebAssembly (WASM) backend.
// - DrawingUtils → helps draw hand skeleton on canvas.


// Callback types you can pass into the hook
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
  // Refs for video and canvas
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hand landmark model instance
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  // Flag to prevent re-initializing model multiple times
  const initializedRef = useRef(false);

  // Store last positions for comparing movements
  const lastYRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);

  // Prevents repeated actions (cooldown between gestures)
  const lastActionRef = useRef<number>(0);

  // History of positions (for smoothing gesture detection)
  const historyYRef = useRef<number[]>([]);
  const historyXRef = useRef<number[]>([]);
  const HISTORY_MAX = 5;   // max length of history
  const COOLDOWN = 500;    // ms between actions (0.5s)

  // Helper to add new value into history (keeps max length)
  function pushHistory(hist: number[], value: number) {
    hist.push(value);
    if (hist.length > HISTORY_MAX) hist.shift();
  }

  useEffect(() => {
    let animationId: number;

    // ---------------- INIT ----------------
    async function init() {
      if (initializedRef.current) return;
      initializedRef.current = true;

      // Load Mediapipe WASM backend
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      // Load hand landmark model
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task",
          },
          runningMode: "VIDEO", // live video processing
          numHands: 1,          // detect 1 hand only
        }
      );

      if (!videoRef.current) return;

      // Ask for webcam permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      videoRef.current.srcObject = stream;
      // When video is ready, start the loop
      videoRef.current.onloadeddata = () => loop();
    }

    // ---------------- LOOP ----------------
    async function loop() {
      if (
        !handLandmarkerRef.current ||
        !videoRef.current ||
        !canvasRef.current
      ) {
        animationId = requestAnimationFrame(loop);
        return;
      }

      // Run hand landmark detection on current video frame
      const results = await handLandmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now()
      );

      // Draw onto canvas
      const ctx = canvasRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const lm = results.landmarks[0]; // first hand landmarks

        // Draw skeleton + landmarks
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, {
          color: "lime",
          lineWidth: 2,
        });
        drawingUtils.drawLandmarks(lm, { color: "red", radius: 4 });

        // Process gestures
        processGestures(lm);
      }

      animationId = requestAnimationFrame(loop);
    }

    // ---------------- GESTURE LOGIC ----------------
    function processGestures(lm: any) {
      // Landmark positions (normalized: 0-1 range)
      const indexTip = lm[8];
      const middleTip = lm[12];
      const ringTip = lm[16];
      const pinkyTip = lm[20];

      const indexMCP = lm[5];
      const middleMCP = lm[9];

      // Check which fingers are raised
      const isIndexUp = indexTip.y < indexMCP.y;
      const isMiddleUp = middleTip.y < middleMCP.y;
      const isRingUp = ringTip.y < lm[13].y;
      const isPinkyUp = pinkyTip.y < lm[17].y;

      // ☝ One finger (index only) → Scroll up
      if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: false });

      // ✌ Two fingers (index + middle) → Scroll down
      } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: true });

      // 🖐 Four fingers (index + middle + ring + pinky) → Horizontal swipe
      } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        handleHorizontalSwipe(lm);

      // ❌ No valid gesture → reset states
      } else {
        lastYRef.current = null;
        lastXRef.current = null;
        historyYRef.current = [];
        historyXRef.current = [];
      }
    }

    // ---------------- VERTICAL SCROLL ----------------
    function handleVerticalScroll(
      lm: any,
      { isIndexUp, isMiddleUp }: { isIndexUp: boolean; isMiddleUp: boolean }
    ) {
      const indexTip = lm[8];
      const middleTip = lm[12];

      // Average Y position if two fingers, else just index
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
      const threshold = 0.02; // small movement sensitivity

      if (lastY !== null && now - lastActionRef.current > COOLDOWN) {
        const deltaY = avgY - lastY;

        if (isIndexUp && isMiddleUp && deltaY < -threshold) {
          // ✌ Two-finger → Scroll Down
          onScrollDown?.();
          lastActionRef.current = now;
          historyYRef.current = [];
        } else if (isIndexUp && !isMiddleUp && deltaY > threshold) {
          // ☝ One-finger → Scroll Up
          onScrollUp?.();
          lastActionRef.current = now;
          historyYRef.current = [];
        }
      }

      lastYRef.current = avgY;
    }

    // ---------------- HORIZONTAL SWIPE ----------------
    function handleHorizontalSwipe(lm: any) {
      const indexTip = lm[8];
      const xNorm = 1 - indexTip.x; // normalized X (flip for mirror effect)

      pushHistory(historyXRef.current, xNorm);

      const lastPos = lastXRef.current;
      const now = Date.now();
      const horizontalThreshold = 0.25; // need bigger movement for swipe

      if (lastPos !== null && now - lastActionRef.current > COOLDOWN) {
        const dx = xNorm - lastPos;

        if (Math.abs(dx) > horizontalThreshold) {
          if (dx > 0) {
            onPrevPage?.(); // swipe right → previous page
          } else {
            onNextPage?.(); // swipe left → next page
          }
          lastActionRef.current = now;
          historyXRef.current = [];
        }
      }

      lastXRef.current = xNorm;
    }

    // Start model
    init();

    // Cleanup animation on unmount
    return () => cancelAnimationFrame(animationId);
  }, [onScrollUp, onScrollDown, onNextPage, onPrevPage]);

  // Expose refs so you can use them in your component
  return { videoRef, canvasRef };
}
