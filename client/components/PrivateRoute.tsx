import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLoadingScreen from "./AppLoadingScreen";

const MIN_LOADING_MS = 300;
const FADE_DURATION_MS = 300;

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { ready, token } = useAuth();
  const [loaderPhase, setLoaderPhase] = useState<"visible" | "exiting" | "hidden">("visible");

  useEffect(() => {
    if (!ready) {
      setLoaderPhase("visible");
      return;
    }

    let fadeTimer: number | undefined;
    const minTimer = window.setTimeout(() => {
      setLoaderPhase("exiting");
      fadeTimer = window.setTimeout(() => {
        setLoaderPhase("hidden");
      }, FADE_DURATION_MS);
    }, MIN_LOADING_MS);

    return () => {
      window.clearTimeout(minTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [ready]);

  if (!ready || loaderPhase !== "hidden") {
    return <AppLoadingScreen isExiting={loaderPhase === "exiting"} />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
