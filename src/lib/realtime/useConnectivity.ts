"use client";

import { useEffect, useState } from "react";

export type ChannelState = "connecting" | "connected" | "disconnected";

/**
 * D30 bağlantı göstergesi: navigator.onLine + Realtime kanal durumunu
 * birleştirir. İkisi de "bağlı" değilse gösterge kırmızı olur.
 */
export function useConnectivity(channelState: ChannelState): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline && channelState === "connected";
}
