"use client";
// Required in Next.js App Router so this hook runs on the client (browser), not server.

import { useEffect, useRef } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { domToPng } from "modern-screenshot";

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
  const HISTORY_MAX = 5; // max length of history
  const COOLDOWN = 500; // ms between actions (0.5s)

  // ---------------- Screenshot logic ----------------
  const fistHoldStartRef = useRef<number | null>(null); // track fist hold start
  const screenshotTakenRef = useRef<boolean>(false); // NEW: flag to track if screenshot was taken for current fist
  const FIST_HOLD_TIME = 2000; // 2 seconds hold for screenshot

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

        videoRef.current.srcObject = stream;
        // When video is ready, start the loop
        videoRef.current.onloadeddata = () => loop();
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
      const isIndexUp = indexTip.y < indexMCP.y - 0.02; // Added small threshold
      const isMiddleUp = middleTip.y < middleMCP.y - 0.02;
      const isRingUp = ringTip.y < ringMCP.y - 0.02;
      const isPinkyUp = pinkyTip.y < pinkyMCP.y - 0.02;

      // Debug logging for fist detection
      const isFist = !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp;

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
            console.log("Taking screenshot..."); // Debug log
            handleScreenshot();
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
          onScrollDown?.();
          lastActionRef.current = now;
          historyYRef.current = [];
        } else if (isIndexUp && !isMiddleUp && deltaY > threshold) {
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
      const xNorm = 1 - indexTip.x;

      pushHistory(historyXRef.current, xNorm);

      const lastPos = lastXRef.current;
      const now = Date.now();
      const horizontalThreshold = 0.15;

      if (lastPos !== null && now - lastActionRef.current > COOLDOWN) {
        const dx = xNorm - lastPos;

        if (Math.abs(dx) > horizontalThreshold) {
          if (dx > 0) onPrevPage?.();
          else onNextPage?.();

          lastActionRef.current = now;
          historyXRef.current = [];
        }
      }

      lastXRef.current = xNorm;
    }

    // ---------------- SCREENSHOT ----------------
    async function handleScreenshot() {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Hide video/canvas temporarily
        if (video) video.style.visibility = "hidden";
        if (canvas) canvas.style.visibility = "hidden";

        // Small delay to ensure elements are hidden
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Method: Create a viewport overlay that captures only what's visible
        const viewportOverlay = document.createElement("div");
        viewportOverlay.id = "screenshot-viewport-overlay";
        viewportOverlay.style.position = "fixed";
        viewportOverlay.style.top = "0";
        viewportOverlay.style.left = "0";
        viewportOverlay.style.width = "100vw";
        viewportOverlay.style.height = "100vh";
        viewportOverlay.style.zIndex = "999999";
        viewportOverlay.style.pointerEvents = "none";
        viewportOverlay.style.backgroundColor = "transparent";
        viewportOverlay.style.overflow = "hidden";

        // Get all elements and check which ones are visible in viewport
        const allElements = Array.from(document.body.getElementsByTagName("*"));
        const viewportRect = {
          top: 0,
          left: 0,
          bottom: window.innerHeight,
          right: window.innerWidth,
        };

        // Clone all visible elements into the overlay
        allElements.forEach((element) => {
          // Skip video, canvas, and our overlay
          if (
            element === video ||
            element === canvas ||
            element === viewportOverlay
          )
            return;
          if (element.tagName === "VIDEO" || element.tagName === "CANVAS")
            return;
          if (element.tagName === "SCRIPT" || element.tagName === "STYLE")
            return;

          const rect = element.getBoundingClientRect();

          // Check if element is visible in current viewport
          const isVisible = !(
            rect.bottom <= 0 ||
            rect.right <= 0 ||
            rect.top >= window.innerHeight ||
            rect.left >= window.innerWidth ||
            rect.width === 0 ||
            rect.height === 0
          );

          if (isVisible) {
            const computedStyle = window.getComputedStyle(element);

            // Only clone leaf elements or elements with background/text content
            const hasVisualContent =
              (computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                computedStyle.backgroundColor !== "transparent") ||
              element.textContent?.trim() ||
              computedStyle.backgroundImage !== "none" ||
              computedStyle.border !== "0px none rgb(0, 0, 0)";

            if (hasVisualContent || element.children.length === 0) {
              try {
                const clone = element.cloneNode(true) as HTMLElement;

                // Position the clone exactly as it appears in viewport
                clone.style.position = "absolute";
                clone.style.left = `${Math.max(0, rect.left)}px`;
                clone.style.top = `${Math.max(0, rect.top)}px`;
                clone.style.width = `${Math.min(
                  rect.width,
                  window.innerWidth - Math.max(0, rect.left)
                )}px`;
                clone.style.height = `${Math.min(
                  rect.height,
                  window.innerHeight - Math.max(0, rect.top)
                )}px`;

                // Copy essential styles
                clone.style.backgroundColor = computedStyle.backgroundColor;
                clone.style.color = computedStyle.color;
                clone.style.fontSize = computedStyle.fontSize;
                clone.style.fontFamily = computedStyle.fontFamily;
                clone.style.fontWeight = computedStyle.fontWeight;
                clone.style.textAlign = computedStyle.textAlign;
                clone.style.padding = computedStyle.padding;
                clone.style.margin = "0";
                clone.style.border = computedStyle.border;
                clone.style.borderRadius = computedStyle.borderRadius;
                clone.style.backgroundImage = computedStyle.backgroundImage;
                clone.style.backgroundSize = computedStyle.backgroundSize;
                clone.style.backgroundPosition =
                  computedStyle.backgroundPosition;
                clone.style.backgroundRepeat = computedStyle.backgroundRepeat;

                // Reset transform and other properties that might interfere
                clone.style.transform = "none";
                clone.style.transition = "none";
                clone.style.animation = "none";
                clone.style.boxShadow = computedStyle.boxShadow;
                clone.style.overflow = "hidden";
                clone.style.zIndex = "auto";

                viewportOverlay.appendChild(clone);
              } catch (cloneError) {
                console.warn("Failed to clone element:", element, cloneError);
              }
            }
          }
        });

        // Add the overlay to document
        document.body.appendChild(viewportOverlay);

        // Wait for rendering
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Use modern-screenshot to capture the overlay
        const dataUrl = await domToPng(viewportOverlay, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: "#ffffff",
          scale: 1,
          style: {
            margin: "0",
            padding: "0",
          },
        });

        // Clean up overlay
        document.body.removeChild(viewportOverlay);

        // Create download link
        const link = document.createElement("a");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.download = `screenshot-${timestamp}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("Modern-screenshot viewport capture completed!");

        // Restore video/canvas visibility
        if (video) video.style.visibility = "visible";
        if (canvas) canvas.style.visibility = "visible";
      } catch (err) {
        console.error("Modern-screenshot failed:", err);

        // Fallback: Try simpler approach with modern-screenshot
        try {
          console.log("Trying simplified modern-screenshot approach...");

          const video = videoRef.current;
          const canvas = canvasRef.current;

          // Find the element that's most visible in current viewport
          let mostVisibleElement = document.body;
          let maxVisibleArea = 0;

          const allDivs = document.querySelectorAll("div");
          allDivs.forEach((div) => {
            const rect = div.getBoundingClientRect();
            const visibleArea =
              Math.max(
                0,
                Math.min(rect.bottom, window.innerHeight) -
                  Math.max(rect.top, 0)
              ) *
              Math.max(
                0,
                Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
              );

            if (visibleArea > maxVisibleArea) {
              maxVisibleArea = visibleArea;
              mostVisibleElement = div;
            }
          });

          console.log("Capturing most visible element:", mostVisibleElement);

          const dataUrl = await domToPng(mostVisibleElement, {
            backgroundColor: "#ffffff",
            scale: 1,
            filter: (node: Node) => {
              if (node === video || node === canvas) return false;

              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.tagName === "VIDEO" || element.tagName === "CANVAS")
                  return false;
              }

              return true;
            },
          });

          const link = document.createElement("a");
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          link.download = `element-screenshot-${timestamp}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          console.log("Fallback element screenshot completed!");
        } catch (fallbackErr) {
          console.error("Fallback also failed:", fallbackErr);
        }

        // Ensure video/canvas are restored even on error
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video) video.style.visibility = "visible";
        if (canvas) canvas.style.visibility = "visible";
      }
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
  }, [onScrollUp, onScrollDown, onNextPage, onPrevPage]);

  // Expose refs
  return { videoRef, canvasRef };
}