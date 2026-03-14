import { useState, useEffect, useRef, useCallback } from "react";
import "./MainScreen.css";

import neutralImg  from "./assets/ok.png";
import thinkingImg from "./assets/confused.png";
import angryImg    from "./assets/angry.png";
import happyImg    from "./assets/happy.png";

// ─── Types ────────────────────────────────────────────────────────────────────

// "thinking" is a transient UI-only state shown while waiting for the LLM
export type CapitalistMood =
  | "idle" | "thinking" | "angry" | "pleased" | "ecstatic" | "disgusted";

export interface EvalResponse {
  score:     number;
  message:   string;
  mood:      Exclude<CapitalistMood, "thinking">;
  ideaId?:   string;
  isGolden?: boolean;
}

export interface IdeaRecord {
  id:        string;
  text:      string;
  score:     number;
  isGolden:  boolean;
  createdAt: string;
}

interface GlobalIdea {
  title:       string;
  description: string;
  examples:    string[];
}

interface BackendIteration {
  version:     number;
  title:       string;
  description: string;
  plan:        string[];
  ranking: {
    originality:     number;
    difficulty:      number;
    marketPotential: number;
    scalability:     number;
  };
  createdAt: string;
}

interface BackendIdea {
  id:         string;
  userId:     string;
  iterations: BackendIteration[];
  createdAt:  string;
  updatedAt:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = "https://luhi-panove-1.onrender.com";

const MOOD_IMAGE: Record<CapitalistMood, string> = {
  idle:      neutralImg,
  thinking:  thinkingImg,
  disgusted: thinkingImg,
  angry:     angryImg,
  pleased:   happyImg,
  ecstatic:  happyImg,
};

const IDLE_MESSAGES: string[] = [
  "You have 60 seconds. Impress me.",
  "My time is money. YOURS TOO.",
  "I'm waiting… and patience costs extra.",
  "The market doesn't sleep. Neither should your brain.",
  "Another day, another quota unfilled.",
  "Mediocrity is free. Excellence costs effort. Pay up.",
];

const NETWORK_FAILURE_MESSAGE =
  "NETWORK FAILURE?! Even your infrastructure is a bad idea!";

const LLM_TIMEOUT_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avgScore(ranking: BackendIteration["ranking"]): number {
  return Math.round(
    (ranking.originality + ranking.difficulty + ranking.marketPotential + ranking.scalability) / 4
  );
}

function toIdeaRecord(idea: BackendIdea): IdeaRecord {
  const latest = idea.iterations[idea.iterations.length - 1];
  const score  = latest?.ranking ? avgScore(latest.ranking) : 0;
  return {
    id:        idea.id,
    text:      latest?.title ?? "Untitled",
    score,
    isGolden:  score >= 80,
    createdAt: idea.createdAt,
  };
}

function scoreToMood(score: number): Exclude<CapitalistMood, "thinking"> {
  if (score >= 80) return "ecstatic";
  if (score >= 60) return "pleased";
  if (score >= 40) return "idle";
  if (score >= 20) return "angry";
  return "disgusted";
}

// ─── Thinking dots bubble text ────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-label="Thinking">
      <span>.</span><span>.</span><span>.</span>
    </span>
  );
}

// ─── Speech Bubble ────────────────────────────────────────────────────────────

interface SpeechBubbleProps {
  message:    string;
  mood:       CapitalistMood;
  animKey:    number;
  isThinking: boolean;
}

function SpeechBubble({ message, mood, animKey, isThinking }: SpeechBubbleProps) {
  return (
    <div key={animKey} className="bubble-container">
      <div className={`speech-bubble bubble-pop mood-${mood}`}>
        <p className="speech-text">
          {isThinking ? <ThinkingDots /> : message}
        </p>
        <div className="bubble-tail"      />
        <div className="bubble-tail-fill" />
      </div>
    </div>
  );
}

// ─── Crossfading character image ──────────────────────────────────────────────

const CROSSFADE_MS = 350;

function CharacterImage({ mood }: { mood: CapitalistMood }) {
  const [slotA, setSlotA] = useState<CapitalistMood>(mood);
  const [slotB, setSlotB] = useState<CapitalistMood>(mood);
  const [active, setActive] = useState<"A" | "B">("A");
  const prevMood = useRef<CapitalistMood>(mood);

  useEffect(() => {
    if (mood === prevMood.current) return;
    prevMood.current = mood;

    if (active === "A") {
      setSlotB(mood);
      requestAnimationFrame(() => requestAnimationFrame(() => setActive("B")));
    } else {
      setSlotA(mood);
      requestAnimationFrame(() => requestAnimationFrame(() => setActive("A")));
    }
  }, [mood]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="character-wrap">
      <div className={`char-slot ${active === "A" ? "active" : "leaving"}`}>
        <img
          className="character-img"
          src={MOOD_IMAGE[slotA]}
          alt={`Capitalist – ${slotA}`}
          draggable={false}
        />
      </div>
      <div className={`char-slot ${active === "B" ? "active" : "leaving"}`}>
        <img
          className="character-img"
          src={MOOD_IMAGE[slotB]}
          alt={`Capitalist – ${slotB}`}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ─── Quota Bar ────────────────────────────────────────────────────────────────

function QuotaBar({ current, target }: { current: number; target: number }) {
  const pct  = Math.min(current / target, 1) * 100;
  const done = current >= target;
  return (
    <div className="quota-bar-wrap">
      <span className="material-symbols-rounded quota-icon"
            style={{ color: done ? "var(--green)" : "var(--accent)" }}>
        {done ? "task_alt" : "pending_actions"}
      </span>
      <div className="quota-track">
        <div className="quota-fill"
             style={{ width: `${pct}%`, background: done ? "var(--green)" : "var(--accent)" }} />
      </div>
      <span className="quota-label">{current}/{target} ideas today</span>
    </div>
  );
}

// ─── Global Idea Banner ───────────────────────────────────────────────────────

function GlobalIdeaBanner() {
  const [idea, setIdea] = useState<GlobalIdea | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/global-idea`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: GlobalIdea) => setIdea(data))
      .catch(() => {});
  }, []);

  if (!idea) return null;

  return (
    <div className={`gib-wrap${open ? " gib-open" : ""}`}>
      <button className="gib-pill" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="material-symbols-rounded gib-icon">lightbulb</span>
        <span className="gib-label">IDEA OF THE DAY</span>
        <span className="gib-title-short">{idea.title}</span>
        <span className="material-symbols-rounded gib-chevron">keyboard_arrow_down</span>
      </button>
      <div className="gib-dropdown" aria-hidden={!open}>
        <div className="gib-dropdown-inner">
          <p className="gib-desc">{idea.description}</p>
          {idea.examples.length > 0 && (
            <ul className="gib-examples">
              {idea.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Ideas Drawer ─────────────────────────────────────────────────────────────

function IdeasDrawer({ onClose }: { onClose: () => void }) {
  const [ideas,   setIdeas]   = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/ideas`);
        if (!res.ok) throw new Error(`${res.status}`);
        const raw: BackendIdea[] = await res.json();
        if (!cancelled) setIdeas(raw.map(toIdeaRecord));
      } catch {
        if (!cancelled) setError("Couldn't load ideas. The market is volatile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-label="Your ideas">
        <div className="drawer-header">
          <span className="drawer-title">YOUR IDEAS</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="drawer-body">
          {loading && (
            <div className="drawer-loading">
              <div className="spinner" /><span>Counting your pennies…</span>
            </div>
          )}
          {error && !loading && (
            <div className="drawer-empty">
              <span className="material-symbols-rounded">wifi_off</span>
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && ideas.length === 0 && (
            <div className="drawer-empty">
              <span className="material-symbols-rounded">lightbulb</span>
              <span>No ideas yet. Get to work.</span>
            </div>
          )}
          {!loading && !error && ideas.map(idea => (
            <div key={idea.id} className={`idea-item${idea.isGolden ? " golden" : ""}`}>
              {idea.isGolden && (
                <span className="material-symbols-rounded idea-star-icon">star</span>
              )}
              <span className="idea-item-text">{idea.text}</span>
              <span className="idea-item-score">{idea.score}/100</span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MainScreen() {
  const [mood,       setMood]       = useState<CapitalistMood>("idle");
  const [message,    setMessage]    = useState<string>(IDLE_MESSAGES[0]);
  const [inputText,  setInputText]  = useState<string>("");
  const [isLoading,  setIsLoading]  = useState<boolean>(false);
  const [ideasToday, setIdeasToday] = useState<number>(0);
  const [shake,      setShake]      = useState<boolean>(false);
  const [bubbleKey,  setBubbleKey]  = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [lastIdeaId, setLastIdeaId] = useState<string | null>(null);
  const [isStarred,  setIsStarred]  = useState<boolean>(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Helpers ───────────────────────────────────────────────────────────────

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const pushMessage = useCallback((text: string, newMood: CapitalistMood) => {
    setMood(newMood);
    setMessage(text);
    setBubbleKey(k => k + 1);
  }, []);

  // ── Global setter for backend / WebSocket ─────────────────────────────────
  useEffect(() => {
    (window as any).setCapitalistMood = (
      newMood:     Exclude<CapitalistMood, "thinking">,
      newMessage?: string,
    ) => {
      setMood(newMood);
      if (newMessage) { setMessage(newMessage); setBubbleKey(k => k + 1); }
      if (newMood === "angry" || newMood === "disgusted") triggerShake();
    };
    return () => { delete (window as any).setCapitalistMood; };
  }, [triggerShake]);

  useEffect(() => {
    const rotate = () => {
      setMood(prev => {
        if (prev === "idle") {
          setMessage(IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)]);
          setBubbleKey(k => k + 1);
        }
        return prev;
      });
      idleTimerRef.current = setTimeout(rotate, 6_000);
    };
    idleTimerRef.current = setTimeout(rotate, 6_000);
    return () => clearTimeout(idleTimerRef.current);
  }, []);

  // ── Star current idea ─────────────────────────────────────────────────────
  const starIdea = useCallback(async () => {
    if (!lastIdeaId || isStarred) return;
    setIsStarred(true); // локально, ендпоінту /star немає
  }, [lastIdeaId, isStarred]);

  // ── Send idea ─────────────────────────────────────────────────────────────
  const sendIdea = useCallback(async () => {
    const idea = inputText.trim();
    if (!idea || isLoading) return;

    setIsLoading(true);
    setInputText("");
    setLastIdeaId(null);
    setIsStarred(false);

    // Показуємо thinking одразу
    setMood("thinking");
    setBubbleKey(k => k + 1);

    const controller = new AbortController();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), LLM_TIMEOUT_MS)
    );

    try {
      // 1. Створити ідею
      const createRes = await Promise.race([
        fetch(`${API}/ideas`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title: idea, description: idea }),
          signal:  controller.signal,
        }),
        timeoutPromise,
      ]);
      if (!createRes.ok) throw new Error(`create: ${createRes.status}`);
      const created: BackendIdea = await createRes.json();

      // 2. Покращити через AI
      const improveRes = await Promise.race([
        fetch(`${API}/ideas/${created.id}/improve`, {
          method: "POST",
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);
      if (!improveRes.ok) throw new Error(`improve: ${improveRes.status}`);
      const improved: BackendIdea = await improveRes.json();

      // 3. Формуємо відповідь
      const latest = improved.iterations[improved.iterations.length - 1];
      const score  = latest?.ranking ? avgScore(latest.ranking) : 50;
      const mood   = scoreToMood(score);
      const msg    = latest?.description
        ? `${latest.title} — ${latest.description}`
        : "I've seen worse. Barely.";

      pushMessage(msg, mood);
      setIdeasToday(n => n + 1);
      setLastIdeaId(improved.id);
      if (score >= 80) setIsStarred(true);
      if (mood === "angry" || mood === "disgusted") triggerShake();

    } catch {
      controller.abort();
      pushMessage(NETWORK_FAILURE_MESSAGE, "angry");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, pushMessage, triggerShake]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendIdea(); }
  };

  const isThinking = mood === "thinking";

  return (
    <div className={`app-shell${shake ? " shake" : ""}`}>

      {/* ── Top bar ── */}
      <header className="top-bar">
        <button className="icon-btn" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
          <span className="material-symbols-rounded">menu</span>
        </button>

        <h1 className="app-title">GIVE ME IDEAS</h1>

        <button
          className={`icon-btn star-btn${isStarred ? " starred" : ""}`}
          aria-label={isStarred ? "Idea starred" : "Star this idea"}
          onClick={starIdea}
          disabled={!lastIdeaId || isStarred}
          title={!lastIdeaId ? "Submit an idea first" : isStarred ? "Already starred" : "Star this idea"}
        >
          <span className="material-symbols-rounded">
            {isStarred ? "star" : "star_border"}
          </span>
        </button>
      </header>

      {/* ── Global Idea Banner (position:absolute, не зсуває layout) ── */}
      <GlobalIdeaBanner />

      {/* ── Main content ── */}
      <main className="main-content">

        <SpeechBubble
          message={message}
          mood={mood}
          animKey={bubbleKey}
          isThinking={isThinking}
        />

        <CharacterImage mood={mood} />

        <QuotaBar current={ideasToday} target={2} />

      </main>

      {/* ── Input bar ── */}
      <footer className="input-bar">
        <div className={`input-wrap${isLoading ? " loading" : ""}`}>
          <input
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

      {/* ── Ideas drawer ── */}
      {drawerOpen && <IdeasDrawer onClose={() => setDrawerOpen(false)} />}

    </div>
  );
}