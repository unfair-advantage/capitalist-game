import { useState, useEffect, useRef, useCallback } from "react";
import "./MainScreen.css";

import neutralImg  from "./assets/ok.png";
import thinkingImg from "./assets/confused.png";
import angryImg    from "./assets/angry.png";
import happyImg    from "./assets/happy.png";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapitalistMood = "idle" | "angry" | "pleased" | "ecstatic" | "disgusted";

export interface EvalResponse {
  score:    number;       // 0–100
  message:  string;
  mood:     CapitalistMood;
  isGolden?: boolean;
}

// ─── Mood → image mapping ─────────────────────────────────────────────────────

const MOOD_IMAGE: Record<CapitalistMood, string> = {
  idle:      neutralImg,
  disgusted: thinkingImg,
  angry:     angryImg,
  pleased:   happyImg,
  ecstatic:  happyImg,
};

// ─── Idle messages ────────────────────────────────────────────────────────────

const IDLE_MESSAGES: string[] = [
  "You have 60 seconds. Impress me.",
  "My time is money. YOURS TOO.",
  "I'm waiting… and patience costs extra.",
  "The market doesn't sleep. Neither should your brain.",
  "Another day, another quota unfilled.",
  "Mediocrity is free. Excellence costs effort. Pay up.",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SpeechBubbleProps {
  message: string;
  mood:    CapitalistMood;
  animKey: number;
}

function SpeechBubble({ message, mood, animKey }: SpeechBubbleProps) {
  return (
    <div key={animKey} className="bubble-container">
      <div className={`speech-bubble bubble-pop mood-${mood}`}>
        <p className="speech-text">{message}</p>
        <div className="bubble-tail"      />
        <div className="bubble-tail-fill" />
      </div>
    </div>
  );
}

interface QuotaBarProps {
  current: number;
  target:  number;
}

function QuotaBar({ current, target }: QuotaBarProps) {
  const pct  = Math.min(current / target, 1) * 100;
  const done = current >= target;

  return (
    <div className="quota-bar-wrap">
      <span
        className="material-symbols-rounded quota-icon"
        style={{ color: done ? "var(--green)" : "var(--gold)" }}
      >
        {done ? "task_alt" : "pending_actions"}
      </span>

      <div className="quota-track">
        <div
          className="quota-fill"
          style={{
            width:      `${pct}%`,
            background: done ? "var(--green)" : "var(--gold)",
          }}
        />
      </div>

      <span className="quota-label">{current}/{target} ideas today</span>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MainScreen() {
  const [mood,       setMood]       = useState<CapitalistMood>("idle");
  const [message,    setMessage]    = useState<string>(IDLE_MESSAGES[0]);
  const [inputText,  setInputText]  = useState<string>("");
  const [isLoading,  setIsLoading]  = useState<boolean>(false);
  const [ideasToday, setIdeasToday] = useState<number>(0);
  const [shake,      setShake]      = useState<boolean>(false);
  const [bubbleKey,  setBubbleKey]  = useState<number>(0);

  const inputRef     = useRef<HTMLInputElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Expose mood setter so the backend / WS layer can call it ───────────────
  // Usage: window.setCapitalistMood("angry", "That idea is WORTHLESS!")
  useEffect(() => {
    (window as any).setCapitalistMood = (
      newMood:    CapitalistMood,
      newMessage?: string,
    ) => {
      setMood(newMood);
      if (newMessage) {
        setMessage(newMessage);
        setBubbleKey(k => k + 1);
      }
      if (newMood === "angry" || newMood === "disgusted") {
        triggerShake();
      }
    };

    return () => {
      delete (window as any).setCapitalistMood;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle message rotation ──────────────────────────────────────────────────
  useEffect(() => {
    const rotate = () => {
      setMood(prev => {
        if (prev === "idle") {
          const idx = Math.floor(Math.random() * IDLE_MESSAGES.length);
          setMessage(IDLE_MESSAGES[idx]);
          setBubbleKey(k => k + 1);
        }
        return prev;
      });
      idleTimerRef.current = setTimeout(rotate, 6_000);
    };

    idleTimerRef.current = setTimeout(rotate, 6_000);
    return () => clearTimeout(idleTimerRef.current);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const pushMessage = useCallback((text: string, newMood: CapitalistMood) => {
    setMood(newMood);
    setMessage(text);
    setBubbleKey(k => k + 1);
  }, []);

  // ── Send idea to backend ───────────────────────────────────────────────────
  const sendIdea = useCallback(async () => {
    const idea = inputText.trim();
    if (!idea || isLoading) return;

    setIsLoading(true);
    setInputText("");
    pushMessage("Analysing your pathetic little idea…", "idle");

    try {
      const res = await fetch("/api/evaluate-idea", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idea }),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data: EvalResponse = await res.json();

      pushMessage(data.message, data.mood);
      setIdeasToday(n => n + 1);

      if (data.mood === "angry" || data.mood === "disgusted") {
        triggerShake();
      }
    } catch (_err) {
      // Fallback while backend isn't wired up yet
      pushMessage("NETWORK FAILURE?! Even your infrastructure is a bad idea!", "angry");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, pushMessage, triggerShake]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendIdea();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`app-shell${shake ? " shake" : ""}`}>

      {/* ── Top bar ── */}
      <header className="top-bar">
        <button className="icon-btn" aria-label="Menu">
          <span className="material-symbols-rounded">menu</span>
        </button>

        <h1 className="app-title">GIVE ME IDEAS</h1>

        <button className="icon-btn" aria-label="Golden Fund">
          <span className="material-symbols-rounded">stars</span>
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="main-content">

        {/* Speech bubble */}
        <SpeechBubble message={message} mood={mood} animKey={bubbleKey} />

        {/* Capitalist character */}
        <div className={`character-wrap mood-${mood}`}>
          <div className="character-shadow" />
          <img
            className="character-img"
            src={MOOD_IMAGE[mood]}
            alt={`Capitalist – ${mood}`}
            draggable={false}
          />
        </div>

        {/* Daily quota */}
        <QuotaBar current={ideasToday} target={2} />

      </main>

      {/* ── Input bar ── */}
      <footer className="input-bar">
        <div className={`input-wrap${isLoading ? " loading" : ""}`}>
          <input
            ref={inputRef}
            className="idea-input"
            type="text"
            placeholder="PITCH YOUR IDEA…"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            maxLength={500}
            aria-label="Idea input"
          />
          {isLoading && <div className="input-shimmer" />}
        </div>

        <button className="action-btn mic-btn" aria-label="Voice input">
          <span className="material-symbols-rounded">mic</span>
        </button>

        <button
          className={`action-btn send-btn${inputText.trim() ? " active" : ""}`}
          onClick={sendIdea}
          disabled={isLoading || !inputText.trim()}
          aria-label="Send idea"
        >
          <span className="material-symbols-rounded">send</span>
        </button>
      </footer>

    </div>
  );
}