"use client";

import { useEffect, useState } from "react";

export type Viewport = "mobile" | "tablet" | "desktop";

const MOBILE_MAX = 900;
const TABLET_MAX = 1200;

function widthToViewport(w: number): Viewport {
  if (w < MOBILE_MAX) return "mobile";
  if (w < TABLET_MAX) return "tablet";
  return "desktop";
}

/**
 * Returns the current viewport bucket: mobile (<900) | tablet (900–1199) | desktop (≥1200).
 * Safe to call in client components; reads window.innerWidth synchronously since
 * the App is mounted with ssr: false.
 */
export function useViewport(): Viewport {
  const [w, setW] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return widthToViewport(w);
}
