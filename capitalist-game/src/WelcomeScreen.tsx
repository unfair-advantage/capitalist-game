import { useEffect, useRef, useState, useCallback } from "react";
import "./WelcomeScreen.css";

// ── Import the capitalist asset (bg already removed) ──────────────────────────
// Drop asset1_1-removebg-preview.png into src/assets/ and rename as preferred.
// Both PNG and SVG work here.
import capitalistImg from "./assets/capitalist-welcome.png";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  /** Called after the exit animation finishes – parent swaps to MainScreen */
  onStart: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [exiting, setExiting]   = useState(false);
  const shellRef                = useRef<HTMLDivElement>(null);
  const EXIT_DURATION_MS        = 450;   // must match CSS .exiting animation

  // ── Backend hook: call window.showWelcomeScreen() to re-show this screen ──
  // (useful if backend wants to force a reset / re-onboarding flow)
  useEffect(() => {
    (window as any).__welcomeScreenMounted = true;
    return () => {
      delete (window as any).__welcomeScreenMounted;
    };
  }, []);

  // ── Trigger exit animation then hand off to parent ────────────────────────
  const handleStart = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onStart, EXIT_DURATION_MS);
  }, [exiting, onStart]);

  // ── Keyboard shortcut: Enter / Space starts the game ─────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStart]);

  return (
    <div
      ref={shellRef}
      className={`welcome-shell${exiting ? " exiting" : ""}`}
      role="main"
    >
      {/* ── Title ── */}
      <div className="welcome-title-block" aria-label="Get 2 Pitch!">
        {/* Row 1: GET + superscript 2 */}
        <div className="title-row">
          <span className="title-get">GET</span>
          <span className="title-two">2</span>
        </div>
        {/* Row 2: PITCH! */}
        <span className="title-pitch">PITCH!</span>
      </div>

      {/* ── Character ── */}
      <div className="welcome-character">
        <img
          className="welcome-character-img"
          src={capitalistImg}
          alt="The Capitalist – looking impatient"
          draggable={false}
        />
      </div>

      {/* ── Bottom: button + credits ── */}
      <div className="welcome-bottom">
        <button
          className="start-btn"
          onClick={handleStart}
          aria-label="Start the game"
        >
          <span className="start-btn-text">START</span>
          <span className="start-btn-arrow">→</span>
        </button>

        <p className="welcome-credits">
          Made by Ivan Krykun, Maksym Pasko and Andrii Tkhorenko
        </p>
      </div>
    </div>
  );
}