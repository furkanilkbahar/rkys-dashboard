"use client";

import { useEffect, useRef, useState } from "react";

// Tarayıcı autoplay politikası yüzünden AudioContext yalnızca bir kullanıcı
// etkileşiminden sonra başlatılabilir — bkz. useSoundUnlock.
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function useSoundUnlock() {
  const [unlocked, setUnlocked] = useState(false);

  function unlock() {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") {
      void ctx.resume();
    }
    setUnlocked(true);
  }

  return { unlocked, unlock };
}

export function playBeep() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.25);
}

/**
 * D28 ısrarcı tekrar modu: `active` true olduğu sürece belirli aralıklarla
 * ses çalar ("garson duymadı" senaryosunu öldürmek için) — açık çağrı/hazır
 * sipariş kalmayınca (active=false) durur.
 */
export function useInsistentAlert(active: boolean, unlocked: boolean, intervalMs = 8000) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active && unlocked) {
      playBeep();
      intervalRef.current = setInterval(playBeep, intervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, unlocked, intervalMs]);
}
