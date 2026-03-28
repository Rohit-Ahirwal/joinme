import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";

const getPath = () => {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
};

export function App() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const handleNavigation = () => setPath(getPath());
    window.addEventListener("hashchange", handleNavigation);
    return () => window.removeEventListener("hashchange", handleNavigation);
  }, []);

  if (path.startsWith("/room/")) {
    const roomId = path.split("/room/")[1] ?? "";
    return <RoomPage roomId={roomId} onNavigateHome={() => navigate("/")} />;
  }

  return <LandingPage onNavigateToRoom={(roomUrl) => navigate(roomUrl, setPath)} />;
}

function navigate(pathname: string, setPath?: (value: string) => void) {
  window.location.hash = pathname;
  if (setPath) {
    setPath(pathname);
  } else {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
