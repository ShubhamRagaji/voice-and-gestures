import { useState, useEffect, useRef } from "react";

// Global state cache to persist across component remounts
const globalStateCache: { [key: string]: any } = {};

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  storage: "session" | "memory" = "memory"
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Check global cache first
  const getInitialState = (): T => {
    if (globalStateCache[key] !== undefined) {
      return globalStateCache[key];
    }

    if (storage === "session" && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          globalStateCache[key] = parsed; // Cache it
          return parsed;
        }
      } catch (error) {
        console.warn(`Failed to parse stored value for key ${key}:`, error);
      }
    }

    return initialValue;
  };

  const [state, setState] = useState<T>(getInitialState);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the first render to avoid overwriting with initialValue
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Update global cache
    globalStateCache[key] = state;

    // Update session storage if enabled
    if (storage === "session" && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.warn(`Failed to store value for key ${key}:`, error);
      }
    }
  }, [key, state, storage]);

  return [state, setState];
}
