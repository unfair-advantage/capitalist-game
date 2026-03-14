import { useState, useEffect, useRef, useCallback } from "react";
import "./MainScreen.css";

import neutralImg  from "./assets/ok.png";
import thinkingImg from "./assets/confused.png";
import angryImg    from "./assets/angry.png";
import happyImg    from "./assets/happy.png";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapitalistMood = "idle" | "angry" | "pleased" | "ecstatic" | "disgusted";

// Структура відповіді бекенду для ідеї
interface BackendIteration {
  version: number;
  title: string;
  description: string;
  plan: string[];
  ranking: {
    originality: number;
    difficulty: number;
    marketPotential: number;
    scalability: number;
  };
  createdAt: string;
}

interface BackendIdea {
  id: string;
  userId: string;
  iterations: BackendIteration[];
  createdAt: string;
  updatedAt: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAvgScore(ranking: BackendIteration["ranking"]): number {
  return Math.round(
    (ranking.originality + ranking.difficulty + ranking.marketPotential + ranking.scalability) / 4
  );
}

function scoreToMood(score: number): CapitalistMood {
  if (score >= 80) return "ecstatic";
  if (score >= 60) return "pleased";
  if (score >= 40) return "idle";
  if (score >= 20) return "angry";
  return "disgusted";
}

function ideaToRecord(idea: BackendIdea): IdeaRecord {
  const latest = idea.iterations[idea.iterations.length - 1];
  const score  = latest?.ranking ? calcAvgScore(latest.ranking) : 0;
  return {
    id:        idea.id,
    text:      latest?.title ?? "Untitled",
    score,
    isGolden:  score >= 80,
    createdAt: idea.createdAt,
  };
}

// ─── Asset map ────────────────────────────────────────────────────────────────

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

// ─── Speech Bubble ────────────────────────────────────────────────────────────

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
    fetch("https://luhi-panove-1.onrender.com/global-idea")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: GlobalIdea) => setIdea(data))
      .catch(() => {});
  }, []);

  if (!idea) return null;

  return (
    // position: absolute — не зсуває layout нижче
    <div className={`gib-wrap${open ? " gib-open" : ""}`}>

      {/* ── Завжди видимий рядок-пілюля ── */}
      <button className="gib-pill" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="material-symbols-rounded gib-icon">lightbulb</span>
        <span className="gib-label">IDEA OF THE DAY</span>
        <span className="gib-title-short">{idea.title}</span>
        <span className="material-symbols-rounded gib-chevron">keyboard_arrow_down</span>
      </button>

      {/* ── Slide-down дропдаун ── */}
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

interface DrawerProps {
  onClose: () => void;
}

function IdeasDrawer({ onClose }: DrawerProps) {
  const [ideas,   setIdeas]   = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/ideas");
        if (!res.ok) throw new Error(`${res.status}`);
        const raw: BackendIdea[] = await res.json();
        // Конвертуємо BackendIdea[] → IdeaRecord[]
        const data = raw.map(ideaToRecord);
        if (!cancelled) setIdeas(data);
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
              <div className="spinner" />
              <span>Counting your pennies…</span>
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
  const [mood,          setMood]          = useState<CapitalistMood>("idle");
  const [enterClass,    setEnterClass]    = useState<string>("enter-idle");
  const [message,       setMessage]       = useState<string>(IDLE_MESSAGES[0]);
  const [inputText,     setInputText]     = useState<string>("");
  const [isLoading,     setIsLoading]     = useState<boolean>(false);
  const [ideasToday,    setIdeasToday]    = useState<number>(0);
  const [shake,         setShake]         = useState<boolean>(false);
  const [bubbleKey,     setBubbleKey]     = useState<number>(0);
  const [drawerOpen,    setDrawerOpen]    = useState<boolean>(false);
  const [lastIdeaId,    setLastIdeaId]    = useState<string | null>(null);
  const [isStarred,     setIsStarred]     = useState<boolean>(false);

  const inputRef      = useRef<HTMLInputElement>(null);
  const idleTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const enterTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Helper: change mood + play enter animation once ───────────────────────
  const applyMood = useCallback((newMood: CapitalistMood) => {
    clearTimeout(enterTimerRef.current);
    setEnterClass(`enter-${newMood}`);
    setMood(newMood);
    enterTimerRef.current = setTimeout(() => setEnterClass(""), 700);
  }, []);

  // ── Expose global setter for backend/WS usage ─────────────────────────────
  useEffect(() => {
    (window as any).setCapitalistMood = (
      newMood:     CapitalistMood,
      newMessage?: string,
    ) => {
      applyMood(newMood);
      if (newMessage) {
        setMessage(newMessage);
        setBubbleKey(k => k + 1);
      }
      if (newMood === "angry" || newMood === "disgusted") triggerShake();
    };
    return () => { delete (window as any).setCapitalistMood; };
  }, [applyMood]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle message rotation ─────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const pushMessage = useCallback((text: string, newMood: CapitalistMood) => {
    applyMood(newMood);
    setMessage(text);
    setBubbleKey(k => k + 1);
  }, [applyMood]);

  // ── Star current idea ─────────────────────────────────────────────────────
  // Бекенд не має ендпоінту /star — зберігаємо лише локально
  const starIdea = useCallback(async () => {
    if (!lastIdeaId || isStarred) return;
    setIsStarred(true);
  }, [lastIdeaId, isStarred]);

  // ── Send idea ─────────────────────────────────────────────────────────────
  const sendIdea = useCallback(async () => {
    const idea = inputText.trim();
    if (!idea || isLoading) return;

    setIsLoading(true);
    setInputText("");
    setLastIdeaId(null);
    setIsStarred(false);
    pushMessage("Analysing your pathetic little idea…", "idle");

    try {
      // 1. Створити ідею (POST /ideas)
      const createRes = await fetch("/api/ideas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: idea, description: idea }),
      });
      if (!createRes.ok) throw new Error(`create: ${createRes.status}`);
      const created: BackendIdea = await createRes.json();
      const ideaId = created.id;

      // 2. Покращити через Gemini AI (POST /ideas/:id/improve)
      const improveRes = await fetch(`/api/ideas/${ideaId}/improve`, {
        method: "POST",
      });
      if (!improveRes.ok) throw new Error(`improve: ${improveRes.status}`);
      const improved: BackendIdea = await improveRes.json();

      // 3. Читаємо останню ітерацію і рахуємо score
      const latest = improved.iterations[improved.iterations.length - 1];
      const score  = latest?.ranking ? calcAvgScore(latest.ranking) : 50;
      const mood   = scoreToMood(score);

      const displayMessage = latest?.description
        ? `${latest.title} — ${latest.description}`
        : "I've seen worse. Barely.";

      pushMessage(displayMessage, mood);
      setIdeasToday(n => n + 1);
      setLastIdeaId(ideaId);
      if (score >= 80) setIsStarred(true);

      if (mood === "angry" || mood === "disgusted") triggerShake();
    } catch {
      pushMessage("NETWORK FAILURE?! Even your infrastructure is a bad idea!", "angry");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, pushMessage, triggerShake]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendIdea(); }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`app-shell${shake ? " shake" : ""}`}>

      {/* ── Top bar ── */}
      <header className="top-bar">
        <button className="icon-btn" aria-label="Menu"
                onClick={() => setDrawerOpen(true)}>
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

      {/* ── Global Idea Banner (абсолютно позиціонований, не зсуває layout) ── */}
      <GlobalIdeaBanner />

      {/* ── Main content ── */}
      <main className="main-content">

        <SpeechBubble message={message} mood={mood} animKey={bubbleKey} />

        <div className={`character-wrap mood-${mood}`}>
          <div className="character-shadow" />
          <img
            key={mood}
            className={`character-img ${enterClass}`}
            src={MOOD_IMAGE[mood]}
            alt={`Capitalist – ${mood}`}
            draggable={false}
          />
        </div>

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

      {/* ── Ideas drawer ── */}
      {drawerOpen && <IdeasDrawer onClose={() => setDrawerOpen(false)} />}

    </div>
  );
}