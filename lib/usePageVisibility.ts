"use client";

import { useEffect, useState } from "react";

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const readVisibility = () =>
      setIsVisible(document.visibilityState !== "hidden");

    readVisibility();
    document.addEventListener("visibilitychange", readVisibility);
    return () => document.removeEventListener("visibilitychange", readVisibility);
  }, []);

  return isVisible;
}
