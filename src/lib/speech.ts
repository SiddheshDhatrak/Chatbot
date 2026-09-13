"use client";

/** Tiny wrappers around the Web Speech APIs with graceful fallbacks. */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: Iterable<{ isFinal: boolean; 0: { transcript: string } }>;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let speakingId: string | null = null;

export function isSpeaking(id: string): boolean {
  try {
    return speakingId === id && window.speechSynthesis.speaking;
  } catch {
    return false;
  }
}

export function toggleReadAloud(id: string, text: string): boolean {
  if (!canSpeak()) return false;
  const synth = window.speechSynthesis;
  if (speakingId === id && synth.speaking) {
    synth.cancel();
    speakingId = null;
    return false;
  }
  synth.cancel();
  const plain = text
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/[#*>`_|\-]/g, "")
    .slice(0, 2000);
  const utter = new SpeechSynthesisUtterance(plain);
  utter.rate = 1;
  utter.onend = () => {
    if (speakingId === id) speakingId = null;
  };
  speakingId = id;
  synth.speak(utter);
  return true;
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  speakingId = null;
}

export function hasVoiceInput(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface VoiceHandle {
  stop: () => void;
}

/** Start dictation; calls onText with interim/final transcripts. Returns a stop handle. */
export function startDictation(
  onText: (text: string, final: boolean) => void,
  onEnd?: () => void,
): VoiceHandle | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e: SpeechRecognitionEventLike) => {
    let interim = "";
    let fin = "";
    for (const res of e.results) {
      if (res.isFinal) fin += res[0].transcript;
      else interim += res[0].transcript;
    }
    onText(fin || interim, Boolean(fin));
  };
  rec.onend = () => onEnd?.();
  rec.onerror = () => onEnd?.();
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => { try { rec.stop(); } catch {} } };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
