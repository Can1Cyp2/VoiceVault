import Constants from "expo-constants";
import { Audio } from "expo-av";
import { NativeModules, Platform } from "react-native";

type PitchDebugData = Record<string, unknown>;

type PitchDebugEvent = {
  timestamp: string;
  event: string;
  data?: PitchDebugData;
};

const MAX_DEBUG_EVENTS = 220;
const pitchDebugEvents: PitchDebugEvent[] = [];
let isPitchDebugCollectionEnabled = false;

const serializeValue = (value: unknown): string => {
  try {
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        if (typeof currentValue === "function") {
          return `[Function ${currentValue.name || "anonymous"}]`;
        }

        return currentValue;
      },
      2
    );
  } catch (error) {
    return String(value);
  }
};

export const addPitchDebugEvent = (
  event: string,
  data?: PitchDebugData
) => {
  if (!isPitchDebugCollectionEnabled) {
    return;
  }

  pitchDebugEvents.push({
    timestamp: new Date().toISOString(),
    event,
    data,
  });

  if (pitchDebugEvents.length > MAX_DEBUG_EVENTS) {
    pitchDebugEvents.splice(0, pitchDebugEvents.length - MAX_DEBUG_EVENTS);
  }
};

export const setPitchDebugCollectionEnabled = (enabled: boolean) => {
  const wasEnabled = isPitchDebugCollectionEnabled;
  isPitchDebugCollectionEnabled = enabled;

  if (!enabled) {
    pitchDebugEvents.splice(0, pitchDebugEvents.length);
    return;
  }

  if (!wasEnabled) {
    addPitchDebugEvent("debug.enabled");
  }
};

export const getPitchDebugCollectionEnabled = () => isPitchDebugCollectionEnabled;

export const clearPitchDebugEvents = () => {
  pitchDebugEvents.splice(0, pitchDebugEvents.length);
  addPitchDebugEvent("debug.cleared");
};

export const getPitchDebugEvents = () =>
  isPitchDebugCollectionEnabled ? [...pitchDebugEvents] : [];

export const buildPitchDebugReport = async (
  screenContext: PitchDebugData = {}
): Promise<string> => {
  if (!isPitchDebugCollectionEnabled) {
    return "Pitch debug reports are disabled.";
  }

  const expoConfig = Constants.expoConfig as any;
  const nativeModuleNames = Object.keys(NativeModules || {});
  const pitchDetectorModule = NativeModules?.PitchDetectorModule;

  let microphonePermission: PitchDebugData;
  try {
    const permission = await Audio.getPermissionsAsync();
    microphonePermission = {
      status: permission.status,
      granted: permission.granted,
      canAskAgain: permission.canAskAgain,
      expires: permission.expires,
    };
  } catch (error) {
    microphonePermission = {
      error: serializeValue(error),
    };
  }

  const environment = {
    generatedAt: new Date().toISOString(),
    platform: Platform.OS,
    platformVersion: Platform.Version,
    isDev: __DEV__,
    appVersion: expoConfig?.version,
    iosBuildNumber: expoConfig?.ios?.buildNumber,
    androidVersionCode: expoConfig?.android?.versionCode,
    runtimeVersion: expoConfig?.runtimeVersion,
    nativePitchModulePresent: !!pitchDetectorModule,
    nativePitchModuleMethods: pitchDetectorModule
      ? Object.keys(pitchDetectorModule)
      : [],
    nativeModuleNamesContainingPitch: nativeModuleNames.filter((name) =>
      name.toLowerCase().includes("pitch")
    ),
    microphonePermission,
  };

  const eventLines = pitchDebugEvents.map((entry, index) => {
    const data = entry.data ? `\n${serializeValue(entry.data)}` : "";
    return `${index + 1}. [${entry.timestamp}] ${entry.event}${data}`;
  });

  return [
    "VoiceVault Pitch Debug Report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Screen Context:",
    serializeValue(screenContext),
    "",
    "Environment:",
    serializeValue(environment),
    "",
    `Events (${pitchDebugEvents.length}):`,
    eventLines.length ? eventLines.join("\n\n") : "No pitch debug events recorded yet.",
  ].join("\n");
};
