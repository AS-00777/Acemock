import React from "react";
import { DotLottieReact, setWasmUrl } from "@lottiefiles/dotlottie-react";
import loadingAnimation from "../assets/Loading.lottie";

type AppLoadingScreenProps = {
  isExiting?: boolean;
};

const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ isExiting = false }) => {
  return (
    <div
      className={`auth-viewport min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center px-6 transition-opacity duration-200 ease-out ${
        !isExiting ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Preparing AceMock"
    >
      <div className="flex flex-col items-center text-center">
        <DotLottieReact
          src={loadingAnimation}
          autoplay
          loop
          className="h-44 w-44 sm:h-56 sm:w-56"
        />
        <p className="mt-5 text-sm sm:text-base font-black tracking-[0.18em] uppercase text-slate-600 dark:text-neutral-300">
          Preparing AceMock...
        </p>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
