"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      fetch("/api/views/track", { method: "POST", keepalive: true });
    } catch {
      // ignore
    }
  }, [pathname]);
  return null;
}
