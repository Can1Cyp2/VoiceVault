import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync as setExpoAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from "expo-audio";

type PlaybackStatusCallback = (status: AudioStatus) => void;

type InitialPlaybackStatus = {
  shouldPlay?: boolean;
  volume?: number;
  isLooping?: boolean;
  positionMillis?: number;
};

type LegacyAudioMode = {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  shouldDuckAndroid?: boolean;
  playThroughEarpieceAndroid?: boolean;
};

type RemovableSubscription = { remove: () => void };

const PLAYER_UPDATE_INTERVAL_MS = 100;
const PLAYER_LOAD_TIMEOUT_MS = 10_000;

const waitForPlayerToLoad = (player: AudioPlayer): Promise<AudioStatus> => {
  if (player.isLoaded) {
    return Promise.resolve(player.currentStatus);
  }

  return new Promise((resolve, reject) => {
    let subscription: RemovableSubscription | undefined;
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      callback();
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Audio source did not load in time.")));
    }, PLAYER_LOAD_TIMEOUT_MS);

    subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.error) {
        finish(() => reject(new Error(status.error ?? "Audio source failed to load.")));
      } else if (status.isLoaded) {
        finish(() => resolve(status));
      }
    });
  });
};

/**
 * Transitional API used by the app's existing sound effects. It keeps the
 * established Sound lifecycle while using Expo 57's expo-audio native module.
 */
export namespace Audio {
  export class Sound {
    private player: AudioPlayer | null = null;
    private statusSubscription: RemovableSubscription | null = null;

    static async createAsync(
      source: AudioSource,
      initialStatus: InitialPlaybackStatus = {}
    ): Promise<{ sound: Sound; status: AudioStatus }> {
      const sound = new Sound();
      let status = await sound.loadAsync(source, initialStatus);

      if (initialStatus.shouldPlay) {
        await sound.playAsync();
        status = sound.getPlayer().currentStatus;
      }

      return { sound, status };
    }

    async loadAsync(
      source: AudioSource,
      initialStatus: InitialPlaybackStatus = {}
    ): Promise<AudioStatus> {
      await this.unloadAsync();

      const player = createAudioPlayer(source, {
        updateInterval: PLAYER_UPDATE_INTERVAL_MS,
        keepAudioSessionActive: true,
      });
      this.player = player;
      player.volume = initialStatus.volume ?? 1;
      player.loop = initialStatus.isLooping ?? false;

      try {
        const status = await waitForPlayerToLoad(player);
        if (initialStatus.positionMillis) {
          await player.seekTo(initialStatus.positionMillis / 1000);
        }
        return status;
      } catch (error) {
        player.remove();
        if (this.player === player) this.player = null;
        throw error;
      }
    }

    async playAsync(): Promise<void> {
      this.getPlayer().play();
    }

    async replayAsync(): Promise<void> {
      const player = this.getPlayer();
      await player.seekTo(0);
      player.play();
    }

    async stopAsync(): Promise<void> {
      const player = this.player;
      if (!player) return;
      player.pause();
      await player.seekTo(0);
    }

    async setVolumeAsync(volume: number): Promise<void> {
      this.getPlayer().volume = Math.max(0, Math.min(1, volume));
    }

    setOnPlaybackStatusUpdate(callback: PlaybackStatusCallback | null): void {
      this.statusSubscription?.remove();
      this.statusSubscription = null;

      if (!callback || !this.player) return;
      this.statusSubscription = this.player.addListener(
        "playbackStatusUpdate",
        callback
      );
    }

    async unloadAsync(): Promise<void> {
      this.statusSubscription?.remove();
      this.statusSubscription = null;

      const player = this.player;
      this.player = null;
      player?.remove();
    }

    private getPlayer(): AudioPlayer {
      if (!this.player) {
        throw new Error("Audio sound has not been loaded.");
      }
      return this.player;
    }
  }

  export const setAudioModeAsync = (mode: LegacyAudioMode): Promise<void> =>
    setExpoAudioModeAsync({
      allowsRecording: mode.allowsRecordingIOS ?? false,
      playsInSilentMode: mode.playsInSilentModeIOS ?? false,
      shouldPlayInBackground: mode.staysActiveInBackground ?? false,
      interruptionMode: mode.shouldDuckAndroid ? "duckOthers" : "doNotMix",
      shouldRouteThroughEarpiece: mode.playThroughEarpieceAndroid ?? false,
    });

  export const getPermissionsAsync = getRecordingPermissionsAsync;
  export const requestPermissionsAsync = requestRecordingPermissionsAsync;
}
