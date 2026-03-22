"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ isFinal: boolean; length: number; [i: number]: { transcript?: string } }>;
}

function getTranscriptFromResult(
  result: { length: number; [i: number]: { transcript?: string } }
): string {
  if (result.length === 0) return "";
  const first = result[0];
  return typeof first === "object" && first !== null && "transcript" in first
    ? String(first.transcript ?? "").trim()
    : "";
}

const MicIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden
  >
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const StopIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-5 w-5"
    aria-hidden
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export function VoiceInput({
  onResult,
  onInterimResult,
  disabled,
  className,
  iconOnly,
}: {
  onResult: (text: string) => void;
  onInterimResult?: (text: string) => void;
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const pendingTranscriptRef = useRef<string>("");

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  const stopListening = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        recRef.current.abort();
      }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    pendingTranscriptRef.current = "";
    const rec = new (SpeechRecognition as new () => SpeechRecognitionInstance)();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const results = e.results;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const text = getTranscriptFromResult(result);
        if (result.isFinal && text) {
          pendingTranscriptRef.current = text;
        } else if (text) {
          pendingTranscriptRef.current = text;
        }
      }
      const current = pendingTranscriptRef.current;
      if (current && onInterimResult) onInterimResult(current);
    };
    rec.onend = () => {
      const finalText = pendingTranscriptRef.current;
      if (finalText) {
        onResult(finalText);
        pendingTranscriptRef.current = "";
      } else if (onInterimResult) {
        onInterimResult("");
      }
      recRef.current = null;
      setListening(false);
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        const finalText = pendingTranscriptRef.current;
        if (finalText) {
          onResult(finalText);
          pendingTranscriptRef.current = "";
        } else if (onInterimResult) {
          onInterimResult("");
        }
      } else if (onInterimResult) {
        onInterimResult("");
      }
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (err) {
      recRef.current = null;
      setListening(false);
    }
  }, [listening, onResult, onInterimResult, stopListening]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (listening) {
      const text = pendingTranscriptRef.current;
      stopListening();
      if (text) {
        onResult(text);
        pendingTranscriptRef.current = "";
      }
    } else {
      startListening();
    }
  }, [disabled, listening, onResult, startListening, stopListening]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      title={listening ? "Click to stop and add to topic" : "Use voice input"}
    >
      {iconOnly ? (
        <span className={listening ? "text-[var(--primary)]" : ""}>
          {listening ? <StopIcon /> : <MicIcon />}
        </span>
      ) : (
        <>{listening ? "Stop" : "Voice input"}</>
      )}
    </button>
  );
}
