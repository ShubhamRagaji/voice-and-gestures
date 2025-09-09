"use client";
import { useEffect, useRef } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// Singleton to prevent reload on page navigation
let handLandmarker: HandLandmarker | null = null;
let initialized = false;

export default function HandNavigator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastActionRef = useRef<number>(0);

  useEffect(() => {
    let animationId: number;

    async function init() {
      if (initialized) return;
      initialized = true;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      // Setup webcam
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
      if (!handLandmarker || !videoRef.current || !canvasRef.current) return;

      const results = await handLandmarker.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const ctx = canvasRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);

        // Draw hand skeleton
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(
            landmarks,
            HandLandmarker.HAND_CONNECTIONS,
            { color: "lime", lineWidth: 2 }
          );
          drawingUtils.drawLandmarks(landmarks, { color: "red", radius: 4 });
        }

        // Index finger tip
        const finger = results.landmarks[0][8];
        // Flip X-axis to match screen movement
        const xNorm = 1 - finger.x;
        const yNorm = finger.y;

        const x = xNorm * window.innerWidth;
        const y = yNorm * window.innerHeight;

        // Move cursor
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }

        // Detect gestures
        detectGestures(xNorm, yNorm);
      }

      animationId = requestAnimationFrame(loop);
    }

    function detectGestures(x: number, y: number) {
      const now = Date.now();
      const lastPos = lastPosRef.current;

      if (!lastPos) {
        lastPosRef.current = { x, y };
        return;
      }

      const dx = x - lastPos.x;
      const dy = y - lastPos.y;

      const horizontalThreshold = 0.25;
      const verticalThreshold = 0.15;
      const cooldown = 500;

      // Horizontal navigation
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > horizontalThreshold && now - lastActionRef.current > cooldown) {
          window.history.back();
          lastActionRef.current = now;
        } else if (
          dx < -horizontalThreshold &&
          now - lastActionRef.current > cooldown
        ) {
          window.history.forward();
          lastActionRef.current = now;
        }
      }

      // Vertical scrolling
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > verticalThreshold && now - lastActionRef.current > cooldown) {
          window.scrollBy({ top: 400, behavior: "smooth" });
          lastActionRef.current = now;
        } else if (
          dy < -verticalThreshold &&
          now - lastActionRef.current > cooldown
        ) {
          window.scrollBy({ top: -400, behavior: "smooth" });
          lastActionRef.current = now;
        }
      }

      lastPosRef.current = { x, y };
    }

    init();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <>
      <video ref={videoRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Canvas to draw hand */}
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
          zIndex: 9998,
        }}
      />

      {/* Cursor */}
      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "red",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
        }}
      />
    </>
  );
}