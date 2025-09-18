"use client";
// Required in Next.js App Router so this hook runs on the client (browser), not server.

import { useEffect, useRef } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { domToPng } from "modern-screenshot";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

// Callback types you can pass into the hook
type GestureCallbacks = {
  onNextPage?: () => void;
  onPrevPage?: () => void;
  scrollUpAmount?: number;
  scrollDownAmount?: number;
};

export function useHandGestures({
  onNextPage,
  onPrevPage,
  scrollUpAmount = 400,
  scrollDownAmount = -400,
}: GestureCallbacks) {
  // Refs for video and canvas
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

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
  const HISTORY_MAX = 5; // max length of history
  const COOLDOWN = 500; // ms between actions (0.5s)

  // ---------------- Screenshot logic ----------------
  const fistHoldStartRef = useRef<number | null>(null); // track fist hold start
  const screenshotTakenRef = useRef<boolean>(false); // NEW: flag to track if screenshot was taken for current fist
  const FIST_HOLD_TIME = 2500; // 2.5 seconds hold for screenshot

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

      try {
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
            numHands: 1, // detect 1 hand only
          }
        );

        if (!videoRef.current) return;

        // Ask for webcam permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });

        const loadingToastId = toast.info(
          "Initializing hand gesture detection...",
          { autoClose: false, closeOnClick: false }
        );

        videoRef.current.srcObject = stream;
        // When video is ready, start the loop
        videoRef.current.onloadeddata = () => {
          toast.dismiss(loadingToastId);

          toast.success(
            "Camera initialized! Hand gesture detection is now active.",
            {
              autoClose: 3000,
              onClose: () => {
                let alreadyShown = sessionStorage.getItem(
                  "gestureInstructionsShown"
                );

                if (alreadyShown === "true") return;

                // Show gesture instructions after success toast closes
                toast.info(
                  <div>
                    <div className="pb-2">👆 One finger: Scroll up</div>
                    <div className="pb-2">✌️ Two fingers: Scroll down</div>
                    <div className="pb-2">🖐 Four fingers: Swipe</div>
                    <div className="pb-2">✊ Fist (hold 2.5s): Screenshot</div>
                  </div>,
                  {
                    autoClose: 8000,
                    pauseOnHover: true,
                  }
                );

                if (alreadyShown !== "true") {
                  sessionStorage.setItem("gestureInstructionsShown", "true");
                }
              },
            }
          );
          loop();
        };
      } catch (error) {
        console.error("Failed to initialize hand tracking:", error);
      }
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

      try {
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
        } else {
          // Reset fist timer and screenshot flag when no hand is detected
          fistHoldStartRef.current = null;
          screenshotTakenRef.current = false; // RESET screenshot flag when hand disappears
        }
      } catch (error) {
        console.error("Error in detection loop:", error);
      }

      animationId = requestAnimationFrame(loop);
    }

    // ---------------- GESTURE LOGIC ----------------
    function processGestures(lm: any) {
      const indexTip = lm[8];
      const middleTip = lm[12];
      const ringTip = lm[16];
      const pinkyTip = lm[20];

      const indexMCP = lm[5];
      const middleMCP = lm[9];
      const ringMCP = lm[13]; // Added for ring finger
      const pinkyMCP = lm[17]; // Added for pinky

      // Check which fingers are raised - improved detection
      const isIndexUp = indexTip.y < indexMCP.y; // Added small threshold
      const isMiddleUp = middleTip.y < middleMCP.y;
      const isRingUp = ringTip.y < ringMCP.y;
      const isPinkyUp = pinkyTip.y < pinkyMCP.y;

      // Debug logging for fist detection
      const isFist = isFistGesture(lm);

      // ☝ One finger (index only) → Scroll up
      if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: false });
        // Reset fist-related flags when other gestures are detected
        fistHoldStartRef.current = null;
        screenshotTakenRef.current = false;
      }
      // ✌ Two fingers (index + middle) → Scroll down
      else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        handleVerticalScroll(lm, { isIndexUp, isMiddleUp: true });
        // Reset fist-related flags
        fistHoldStartRef.current = null;
        screenshotTakenRef.current = false;
      }
      // 🖐 Four fingers → Horizontal swipe
      else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        handleHorizontalSwipe(lm);
        // Reset fist-related flags
        fistHoldStartRef.current = null;
        screenshotTakenRef.current = false;
      }
      // ✊ Fist (all fingers down) → screenshot after 2s hold
      else if (isFist) {
        console.log("Fist detected!"); // Debug log

        // If screenshot already taken for this fist gesture, do nothing
        if (screenshotTakenRef.current) {
          console.log("Screenshot already taken for this fist gesture");
          return;
        }

        if (!fistHoldStartRef.current) {
          fistHoldStartRef.current = Date.now();
          console.log("Started fist timer"); // Debug log
        } else {
          const holdTime = Date.now() - fistHoldStartRef.current;
          console.log(`Fist hold time: ${holdTime}ms`); // Debug log

          if (holdTime >= FIST_HOLD_TIME) {
            const captureScreenshot = toast.info("Taking screenshot..."); // Debug log
            handleScreenshot(captureScreenshot);
            screenshotTakenRef.current = true; // Mark screenshot as taken
            // DON'T reset fistHoldStartRef.current here - let it stay until gesture changes
          }
        }
      }
      // ❌ No valid gesture → reset states
      else {
        lastYRef.current = null;
        lastXRef.current = null;
        historyYRef.current = [];
        historyXRef.current = [];
        // Reset fist-related flags when no gesture is detected
        fistHoldStartRef.current = null;
        screenshotTakenRef.current = false;
      }
    }

    // ---------------- VERTICAL SCROLL ----------------
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
          window.scrollBy({ top: scrollUpAmount, behavior: "smooth" });
          lastActionRef.current = now;
          historyYRef.current = [];
        } else if (isIndexUp && !isMiddleUp && deltaY > threshold) {
          window.scrollBy({ top: scrollDownAmount, behavior: "smooth" });
          lastActionRef.current = now;
          historyYRef.current = [];
        }
      }

      lastYRef.current = avgY;
    }

    // ---------------- HORIZONTAL SWIPE ----------------
    function handleHorizontalSwipe(lm: any) {
      const indexTip = lm[8];
      const xNorm = 1 - indexTip.x;

      pushHistory(historyXRef.current, xNorm);

      const lastPos =
        historyXRef.current.length > 1
          ? historyXRef.current[historyXRef.current.length - 2]
          : null;
      const now = Date.now();
      const horizontalThreshold = 0.16;

      if (lastPos !== null && now - lastActionRef.current > COOLDOWN) {
        const dx = xNorm - lastPos;

        if (Math.abs(dx) > horizontalThreshold) {
          if (dx > 0) onPrevPage?.() || router.back();
          else onNextPage?.() || router.forward();

          lastActionRef.current = now;
          historyXRef.current = [];
        }
      }
    }

    // ---------------- SCREENSHOT ----------------
    async function handleScreenshot(captureScreenshot: any) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Hide video/canvas temporarily
        if (video) video.style.visibility = "hidden";
        if (canvas) canvas.style.visibility = "hidden";

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get current scroll position
        const scrollX =
          window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY =
          window.pageYOffset || document.documentElement.scrollTop;

        console.log(`Current scroll position: x=${scrollX}, y=${scrollY}`);

        // Method 1: Using transform to offset scroll position
        const dataUrl = await domToPng(document.body, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: "#ffffff",
          scale: 1,
          // Offset by current scroll position
          style: {
            transform: `translate(-${scrollX}px, -${scrollY}px)`,
            transformOrigin: "top left",
          },
          filter: (node) => {
            if (node === video || node === canvas) return false;

            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              if (
                ["VIDEO", "CANVAS", "SCRIPT", "STYLE"].includes(element.tagName)
              ) {
                return false;
              }

              if (element.classList?.contains("Toastify__toast-container")) {
                return false;
              }
            }

            return true;
          },
        });

        // Create download link
        const link = document.createElement("a");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.download = `screenshot-${timestamp}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.dismiss(captureScreenshot);
        toast.success("Screenshot saved successfully!");

        // Restore video/canvas visibility
        if (video) video.style.visibility = "visible";
        if (canvas) canvas.style.visibility = "visible";
      } catch (err) {
        console.error("Screenshot failed:", err);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video) video.style.visibility = "visible";
        if (canvas) canvas.style.visibility = "visible";

        toast.dismiss(captureScreenshot);
        toast.error("Screenshot failed. Please try again.");
      }
    }

    function isFistGesture(lm: any) {
      // For each finger: check if tip is close to its MCP joint
      function fingerFolded(tipIndex: number, mcpIndex: number) {
        const tip = lm[tipIndex];
        const mcp = lm[mcpIndex];
        const dist = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);

        // Adjust threshold experimentally (0.07–0.12 usually works)
        return dist < 0.1;
      }

      const indexFolded = fingerFolded(8, 5); // index tip vs MCP
      const middleFolded = fingerFolded(12, 9); // middle tip vs MCP
      const ringFolded = fingerFolded(16, 13); // ring tip vs MCP
      const pinkyFolded = fingerFolded(20, 17); // pinky tip vs MCP

      return indexFolded && middleFolded && ringFolded && pinkyFolded;
    }

    // Start model
    init();

    // Cleanup animation on unmount
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      // Clean up video stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onNextPage, onPrevPage]);

  // Expose refs
  return { videoRef, canvasRef };
}
