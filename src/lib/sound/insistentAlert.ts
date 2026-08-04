"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

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

/* ── Otomatik ses açma (Faz 22) ────────────────────────────────────────
   Tarayıcıların autoplay politikası AudioContext'i yalnızca bir kullanıcı
   JESTİNDEN sonra başlatmaya izin veriyor — bu atlatılamaz. Ama jestin
   ÖZEL bir "Sesi Aç" düğmesine yapılması gerekmiyor: sayfadaki ilk
   dokunuş/tuş (kategori çipi, ürün kartı, "+") da bir jesttir. Bu yüzden
   ilk etkileşimde kendiliğinden açılıyor; misafirin ayrı bir düğmeye
   basmasına gerek kalmadı.

   React dışında yaşayan bir durum olduğu için useSyncExternalStore ile
   okunur — efekt içinde setState zinciri kurulmaz.
   ─────────────────────────────────────────────────────────────────── */
let isUnlocked = false;
let armed = false;
const unlockListeners = new Set<() => void>();

function doUnlock() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  if (isUnlocked) return;
  isUnlocked = true;
  for (const listener of unlockListeners) listener();
}

function armAutoUnlock() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const handler = () => {
    doUnlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchend", handler);
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
  window.addEventListener("touchend", handler);
}

function subscribeUnlock(onStoreChange: () => void) {
  armAutoUnlock();
  unlockListeners.add(onStoreChange);
  return () => {
    unlockListeners.delete(onStoreChange);
  };
}

const getUnlockSnapshot = () => isUnlocked;
// SSR'da ses hiçbir zaman açık değildir; hidrasyondan sonra gerçek durum okunur.
const getUnlockServerSnapshot = () => false;

export function useSoundUnlock() {
  const unlocked = useSyncExternalStore(subscribeUnlock, getUnlockSnapshot, getUnlockServerSnapshot);
  return { unlocked, unlock: doUnlock };
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
