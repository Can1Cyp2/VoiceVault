import { createContext, useContext } from "react";

export type LoadingIntroPreviewDuration = 5_000 | 10_000;

type LoadingIntroContextValue = {
  playLoadingIntro: (durationMs: LoadingIntroPreviewDuration) => void;
};

export const LoadingIntroContext = createContext<LoadingIntroContextValue>({
  playLoadingIntro: () => {},
});

export const useLoadingIntro = () => useContext(LoadingIntroContext);
