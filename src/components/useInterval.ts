import React, { useState, useEffect, useRef } from "react";

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export default function useInterval(
  callback: () => any,
  delay: number | null = null
) {
  const savedCallback = useRef<() => any>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
