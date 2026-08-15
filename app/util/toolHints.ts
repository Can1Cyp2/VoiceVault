import AsyncStorage from "@react-native-async-storage/async-storage";

export type ToolHint = "metronome" | "tuner" | "piano";

interface ToolHintState {
  // User-facing "Feature Tips" preference. Only ever changed by an explicit
  // user (or admin) toggle - never flipped automatically.
  enabled: boolean;
  // Min-interval throttle so an actually-displayed hint doesn't repeat too soon.
  lastShownTime: number;
  // Cooldown set after a tool is used. While now < nextEligibleTime, hints
  // are suppressed even though `enabled` stays true. Each Home-screen visit
  // that doesn't tap a tool nudges this earlier (see HOME_VISIT_DECREMENT_MS),
  // so frequent visitors see the hint again sooner than a flat wait.
  nextEligibleTime: number;
  shownCount: number;
}

const STORAGE_KEY = "@voicevault_tool_hints_v1";
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours minimum between shown hints
const TOOL_USE_COOLDOWN_MS = 48 * 60 * 60 * 1000; // base cooldown after a tool is used
const HOME_VISIT_DECREMENT_MS = 2 * 60 * 60 * 1000; // -2h per Home visit without a tool tap

const HINTS: { tool: ToolHint; message: string }[] = [
  { tool: "metronome", message: "Try the Metronome to practice tempo control" },
  { tool: "tuner", message: "Try the Tuner to check your pitch accuracy" },
  { tool: "piano", message: "Try the Piano to explore note ranges" },
];

async function getHintState(): Promise<ToolHintState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
        lastShownTime: parsed.lastShownTime ?? 0,
        nextEligibleTime: parsed.nextEligibleTime ?? 0,
        shownCount: parsed.shownCount ?? 0,
      };
    }
  } catch (e) {
    console.error("Error loading tool hint state:", e);
  }

  return {
    enabled: true,
    lastShownTime: 0,
    nextEligibleTime: 0,
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

// Admin test mode: in-memory only, so it lasts exactly one app session.
// When on, a hint shows on every Home screen load/focus regardless of
// persisted state, chance, or intervals.
let alwaysShowThisSession = false;

export function setToolHintsAlwaysShow(value: boolean): void {
  alwaysShowThisSession = value;
}

export function getToolHintsAlwaysShow(): boolean {
  return alwaysShowThisSession;
}

export async function shouldShowToolHint(): Promise<boolean> {
  if (alwaysShowThisSession) return true;

  const state = await getHintState();
  if (!state.enabled) return false;

  const now = Date.now();

  // Still cooling down from the last tool use. Each check (i.e. each Home
  // visit where the user didn't tap a tool) shaves 2h off the remaining
  // wait, so it bottoms out at "now" instead of going negative.
  if (state.nextEligibleTime > now) {
    state.nextEligibleTime = Math.max(now, state.nextEligibleTime - HOME_VISIT_DECREMENT_MS);
    await saveHintState(state);
    return false;
  }

  if (now - state.lastShownTime < MIN_INTERVAL_MS) {
    return false;
  }

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
  state.nextEligibleTime = Date.now() + TOOL_USE_COOLDOWN_MS;
  state.shownCount = 0;
  await saveHintState(state);
}

export async function disableToolHints(): Promise<void> {
  const state = await getHintState();
  state.enabled = false;
  // Toggling off clears the cooldown, so turning back on starts fresh.
  state.nextEligibleTime = 0;
  state.lastShownTime = 0;
  await saveHintState(state);
}

export async function enableToolHints(): Promise<void> {
  const state = await getHintState();
  state.enabled = true;
  state.nextEligibleTime = 0;
  state.lastShownTime = 0;
  state.shownCount = 0;
  await saveHintState(state);
}

export async function getToolHintsEnabled(): Promise<boolean> {
  const state = await getHintState();
  return state.enabled;
}
