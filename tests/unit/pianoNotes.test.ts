/**
 * Tests for app/util/pianoNotes.ts
 *
 * Verifies the note-name to audio-file mapping used by the playable piano,
 * and that every note the app can display between C1 and C7 actually has a
 * sound file registered.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  PIANO_NOTE_AUDIO_FILES,
  noteToAudioKey,
  getPianoAudioFile,
} from "../../app/util/pianoNotes";
import { NOTES } from "../../app/util/vocalRange";

describe("noteToAudioKey", () => {
  it("replaces the sharp symbol with 's' to match asset filenames", () => {
    expect(noteToAudioKey("C#4")).toBe("Cs4");
    expect(noteToAudioKey("A#2")).toBe("As2");
  });

  it("leaves natural notes unchanged", () => {
    expect(noteToAudioKey("A4")).toBe("A4");
    expect(noteToAudioKey("C1")).toBe("C1");
  });
});

describe("getPianoAudioFile", () => {
  it("resolves audio for natural and sharp notes", () => {
    expect(getPianoAudioFile("C4")).toBeDefined();
    expect(getPianoAudioFile("C#4")).toBeDefined();
  });

  it("returns undefined for notes below the sampled keyboard (C1)", () => {
    expect(getPianoAudioFile("C0")).toBeUndefined();
    expect(getPianoAudioFile("B0")).toBeUndefined();
  });

  it("returns undefined for garbage input", () => {
    expect(getPianoAudioFile("not-a-note")).toBeUndefined();
  });
});

describe("audio file coverage", () => {
  it("registers exactly 73 samples (6 chromatic octaves + final C7)", () => {
    expect(Object.keys(PIANO_NOTE_AUDIO_FILES)).toHaveLength(73);
  });

  it("has an audio file for every displayable note from C1 to C7", () => {
    const first = NOTES.indexOf("C1");
    const last = NOTES.indexOf("C7");
    const playableNotes = NOTES.slice(first, last + 1);

    const missing = playableNotes.filter(
      (note) => getPianoAudioFile(note) === undefined
    );
    expect(missing).toEqual([]);
  });
});
