import { useState, useEffect, useCallback } from "react";
import WelcomeScreen from "./WelcomeScreen";
import MainScreen    from "./MainScreen";

// ─── Which screen to show ─────────────────────────────────────────────────────

type Screen = "welcome" | "main";

// ─── Backend contract ─────────────────────────────────────────────────────────
//
// From your Node backend (or via WebSocket) call:
//
//   window.showScreen("welcome")   → transitions back to welcome screen
//   window.showScreen("main")      → transitions to main screen
//
// The welcome screen also exposes window.__welcomeScreenMounted (bool) so the
// backend can check whether the user is currently on the welcome screen.

export default function App() {
  // Decide initial screen: backend can set localStorage key "initialScreen"
  // before the PWA loads, or we default to welcome.
  const [screen, setScreen] = useState<Screen>(() => {
    const forced = localStorage.getItem("initialScreen") as Screen | null;
    return forced ?? "welcome";
  });

  // Smooth cross-fade between screens
  const [mainVisible, setMainVisible] = useState(screen === "main");

  const goToMain = useCallback(() => {
    setScreen("main");
    setMainVisible(true);
    localStorage.removeItem("initialScreen");
  }, []);

  const goToWelcome = useCallback(() => {
    setScreen("welcome");
    setMainVisible(false);
  }, []);

  // ── Expose global screen switcher for backend/WS ──────────────────────────
  useEffect(() => {
    (window as any).showScreen = (target: Screen) => {
      if (target === "welcome") goToWelcome();
      if (target === "main")    goToMain();
    };
    return () => { delete (window as any).showScreen; };
  }, [goToMain, goToWelcome]);

  return (
    <>
      {screen === "welcome" && (
        <WelcomeScreen onStart={goToMain} />
      )}

      {/* MainScreen mounts once and stays in the tree; hidden until needed */}
      <div style={{
        display:    mainVisible ? "contents" : "none",
        visibility: mainVisible ? "visible"  : "hidden",
      }}>
        {mainVisible && <MainScreen />}
      </div>
    </>
  );
}