"use client";

import { useHandGestures } from "@/hooks/useHandGestures";
import React, { useEffect, useState } from "react";

type BaseProps = {
  scrollUpAmount?: number;
  scrollDownAmount?: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  customCursor?: React.ReactNode;
  fistHoldTime?: number;
};

// Case 1: Cursor disabled → no sensitivity allowed
type CursorDisabled = {
  showCursor: false;
  cursorSensitivity?: never;
};

// Case 2: Cursor enabled → sensitivity optional
type CursorEnabled = {
  showCursor?: true;
  cursorSensitivity?: number;
};

type HandGesturesProps = BaseProps & (CursorDisabled | CursorEnabled);

export default function HandGestures({
  scrollUpAmount,
  scrollDownAmount,
  onNextPage,
  onPrevPage,
  customCursor,
  cursorSensitivity,
  fistHoldTime,
  showCursor = true,
}: HandGesturesProps) {
  const [showHandLandMarkModel, setshowHandLandMarkModel] =
    useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showCustomCursor, setshowCustomCursor] = useState(true);

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

    if (showCursor === showCustomCursor) {
      console.log("ifff");
      sessionStorage.setItem("showCursor", String(true));
    } else if (showCursor !== showCustomCursor) {
      console.log("elseeee");
      // if (!showCursor) {
      //   sessionStorage.setItem("showCursor", String(true));
      // } else {
      //   sessionStorage.setItem("showCursor", String(false));
      // }

      if (sessionStorage.getItem("showCursor") === "true" && !showCursor) {
        sessionStorage.setItem("showCursor", String(true));
      } else {
        sessionStorage.setItem("showCursor", String(false));
      }
    }
  }, []);

  // useEffect(() => {
  //   const stored = sessionStorage.getItem("showCursor");

  //   if (showCursor === showCustomCursor) {
  //     console.log("ifff");
  //     if (!stored) {
  //       console.log("new");
  //       sessionStorage.setItem("showCursor", String(showCursor));
  //       setshowCustomCursor(true);
  //     } else {
  //       console.log("el");
  //       if (stored === "false") {
  //         console.log("1");
  //         sessionStorage.setItem("showCursor", "false");
  //         setshowCustomCursor(false);

  //         if (showCustomCursor) {
  //           sessionStorage.setItem("showCursor", "true");
  //           setshowCustomCursor(true);
  //         }
  //       } else {
  //         console.log("2");
  //         if (stored === "true" && showCustomCursor) {
  //           console.log("2//1");
  //           sessionStorage.setItem("showCursor", "false");
  //           setshowCustomCursor(false);
  //         } else {
  //           console.log("2//2");
  //           sessionStorage.setItem("showCursor", "true");
  //           setshowCustomCursor(true);
  //         }
  //       }
  //     }
  //   } else if (showCursor !== showCustomCursor) {
  //     console.log("else");
  //     if (stored === "true") {
  //       console.log("16");
  //       sessionStorage.setItem("showCursor", "true");
  //       setshowCustomCursor(true);

  //       // if (!showCursor) {
  //       //   sessionStorage.setItem("showCursor", "false");
  //       //   setshowCustomCursor(false);
  //       // }
  //     } else {
  //       console.log("20");
  //       sessionStorage.setItem("showCursor", String(showCursor));
  //       setshowCustomCursor(showCursor);
  //     }
  //   }

  //   if (!showCustomCursor) {
  //     console.log("inside");
  //     const cursor = document.getElementById("custom-cursor");

  //     if (cursor) {
  //       cursor.style.opacity = "0";
  //     }
  //   }
  // }, []);

  if (!window) {
    return;
  }

  return (
    <>
      {console.log(showCursor, showCustomCursor)}
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
      <div>
        {!customCursor ? (
          <div
            id="custom-cursor"
            className="fixed w-4 h-4 bg-[rgba(0,0,0,0.8)] border-2 border-white rounded-full pointer-events-none z-[10000] hidden shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-opacity duration-200 ease-in-out"
          />
        ) : (
          React.cloneElement(customCursor as React.ReactElement<any>, {
            id: "custom-cursor",
            style: { display: "none" }, // Start hidden, gesture hook will show it
          })
        )}
      </div>
    </>
  );
}
