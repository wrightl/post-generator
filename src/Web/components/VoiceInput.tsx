"use client";

import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}

type SpeechRecognitionType = Window["SpeechRecognition"] | undefined;

function getSpeechRecognition(): SpeechRecognitionType {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function VoiceInput({
  onResult,
  disabled,
  className,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    const rec = new (SpeechRecognition as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { results: { isFinal: boolean; length: number; [i: number]: { transcript: string } }[] }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
    })();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: { results: { isFinal: boolean; length: number; [i: number]: { transcript: string } }[] }) => {
      const t = e.results[e.results.length - 1];
      if (t.isFinal && t.length > 0) onResult(t[0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  }, [onResult]);

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={disabled || listening}
      className={className}
      aria-label={listening ? "Listening…" : "Start voice input"}
      title={listening ? "Listening…" : "Use voice input"}
    >
      {listening ? "Listening…" : "Voice input"}
    </button>
  );
}
