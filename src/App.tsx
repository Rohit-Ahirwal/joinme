import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";

const getPath = () => window.location.pathname;

export function App() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const handleNavigation = () => setPath(getPath());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  if (path.startsWith("/room/")) {
    const roomId = path.split("/room/")[1] ?? "";
    return <RoomPage roomId={roomId} onNavigateHome={() => navigate("/")} />;
  }

  return <LandingPage onNavigateToRoom={(roomUrl) => navigate(roomUrl, setPath)} />;
}

function navigate(pathname: string, setPath?: (value: string) => void) {
  window.history.pushState({}, "", pathname);
  if (setPath) {
    setPath(pathname);
  } else {
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
