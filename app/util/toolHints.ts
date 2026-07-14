import AsyncStorage from "@react-native-async-storage/async-storage";

export type ToolHint = "metronome" | "tuner" | "piano";

interface ToolHintState {
  enabled: boolean;
  lastShownTime: number;
  lastToolUsedTime: number;
  shownCount: number;
  dismissedUntil?: number;
}

const STORAGE_KEY = "@voicevault_tool_hints_v1";
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours minimum between hints
const RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days before re-enabling

const HINTS: { tool: ToolHint; message: string }[] = [
  { tool: "metronome", message: "Try the Metronome to practice tempo control" },
  { tool: "tuner", message: "Try the Tuner to check your pitch accuracy" },
  { tool: "piano", message: "Try the Piano to explore note ranges" },
];

async function getHintState(): Promise<ToolHintState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error loading tool hint state:", e);
  }

  return {
    enabled: true,
    lastShownTime: 0,
    lastToolUsedTime: Date.now(),
    shownCount: 0,
  };
}

async function saveHintState(state: ToolHintState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving tool hint state:", e);
  }
}

export async function shouldShowToolHint(): Promise<boolean> {
  const state = await getHintState();

  if (!state.enabled) {
    // Check if we should re-enable (7 days passed since last tool use)
    if (Date.now() - state.lastToolUsedTime > RESET_INTERVAL_MS) {
      state.enabled = true;
      state.shownCount = 0;
      await saveHintState(state);
      return Math.random() < 0.3; // 30% chance to show when re-enabling
    }
    return false;
  }

  // Check if enough time has passed since last hint
  if (Date.now() - state.lastShownTime < MIN_INTERVAL_MS) {
    return false;
  }

  // 20% chance to show a hint
  return Math.random() < 0.2;
}

export function getRandomToolHint(): { tool: ToolHint; message: string } | null {
  if (HINTS.length === 0) return null;
  return HINTS[Math.floor(Math.random() * HINTS.length)];
}

export async function recordHintShown(): Promise<void> {
  const state = await getHintState();
  state.lastShownTime = Date.now();
  state.shownCount += 1;
  await saveHintState(state);
}

export async function recordToolUsed(): Promise<void> {
  const state = await getHintState();
  state.lastToolUsedTime = Date.now();
  state.enabled = false; // Disable hints when user actively uses tools
  state.shownCount = 0;
  await saveHintState(state);
}

export async function disableToolHints(): Promise<void> {
  const state = await getHintState();
  state.enabled = false;
  await saveHintState(state);
}

export async function enableToolHintsForAdminTest(): Promise<void> {
  const state: ToolHintState = {
    enabled: true,
    lastShownTime: 0,
    lastToolUsedTime: Date.now() - RESET_INTERVAL_MS - 1000, // Ensure 7+ days passed
    shownCount: 0,
  };
  await saveHintState(state);
}
