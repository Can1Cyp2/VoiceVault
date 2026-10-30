/**
 * Tests for app/util/featuredSongs.ts
 *
 * The Featured engine's claims are shown to users as facts about their
 * voice ("every note fits your range", "2 semitones above your top note"),
 * so the note math behind each one is pinned down here.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  estimateVoiceProfile,
  parseNote,
  parseRange,
  scoreSong,
  selectFeaturedSongs,
  tessituraOverlap,
  notesInZone,
  describeVoiceProfile,
  voiceTypeHighlights,
} from "../../app/util/featuredSongs";
import { NOTES } from "../../app/util/vocalRange";
import { makeSong, resetSongIds } from "../helpers/factories";

const v = (note: string) => NOTES.indexOf(note);

beforeEach(() => resetSongIds());

describe("note parsing", () => {
  test("sharps, flats and unicode accidentals land on the same semitone", () => {
    expect(parseNote("C#4")).toBe(v("C#4"));
    expect(parseNote("Db4")).toBe(v("C#4"));
    expect(parseNote("B♭3")).toBe(v("A#3"));
    expect(parseNote(" g4 ")).toBe(v("G4"));
  });

  test("garbage and missing notes are rejected", () => {
    expect(parseNote("H4")).toBe(-1);
    expect(parseNote("")).toBe(-1);
    expect(parseNote(null)).toBe(-1);
  });

  test("ranges accept hyphen or en dash, and reject inverted ranges", () => {
    expect(parseRange("C3 - A4")).toEqual([v("C3"), v("A4")]);
    expect(parseRange("C3 – A4")).toEqual([v("C3"), v("A4")]);
    expect(parseRange("A4 - C3")).toBeNull();
    expect(parseRange("C3")).toBeNull();
  });
});

describe("estimateVoiceProfile", () => {
  test("two-octave range trims 20% off the bottom and 25% off the top", () => {
    // C3-C5 = 24 semitones: bottom 5 (-> F3), top 6 (-> F#4)
    const p = estimateVoiceProfile("C3", "C5")!;
    expect(p.tessLow).toBe(v("F3"));
    expect(p.tessHigh).toBe(v("F#4"));
    expect(p.lowConfidence).toBe(false);
    expect(describeVoiceProfile(p)).toEqual({ range: "C3 to C5", tessitura: "F3 to F#4" });
  });

  test("comfort zone centre sits below the middle of the range", () => {
    const p = estimateVoiceProfile("A2", "A4")!;
    expect(p.center).toBeLessThan((p.low + p.high) / 2);
  });

  test("zone never narrows below a fifth", () => {
    // 10 semitones: trimming 2 + 3 would leave 5, so it widens back to 7
    const p = estimateVoiceProfile("C4", "A#4")!;
    expect(p.tessHigh - p.tessLow).toBe(7);
    expect(p.tessLow).toBeGreaterThanOrEqual(p.low);
    expect(p.tessHigh).toBeLessThanOrEqual(p.high);
  });

  test("very narrow ranges use the whole range and are flagged", () => {
    const p = estimateVoiceProfile("C4", "F4")!;
    expect([p.tessLow, p.tessHigh]).toEqual([v("C4"), v("F4")]);
    expect(p.lowConfidence).toBe(true);
  });

  test("unset (C0) and broken ranges give no profile", () => {
    expect(estimateVoiceProfile("C0", "C0")).toBeNull();
    expect(estimateVoiceProfile("C4", "C3")).toBeNull();
    expect(estimateVoiceProfile(null, "C4")).toBeNull();
  });

  test("notesInZone lists exactly the zone's note names", () => {
    const p = estimateVoiceProfile("C3", "C5")!;
    const zone = notesInZone(p);
    expect(zone[0]).toBe("F3");
    expect(zone[zone.length - 1]).toBe("F#4");
    expect(zone).toHaveLength(14);
  });
});

describe("scoreSong", () => {
  const profile = estimateVoiceProfile("C3", "C5")!; // zone F3 - F#4

  test("song with tessitura inside the zone is a tessitura pick", () => {
    const song = makeSong({
      vocalRange: "D3 - A4",
      tessitura_low: "G3",
      tessitura_median: "B3",
      tessitura_high: "D4",
    });
    const result = scoreSong(song, profile)!;
    expect(result.info.category).toBe("tessitura");
    expect(result.info.reasons.map((r) => r.kind)).toEqual(
      expect.arrayContaining(["sweet-spot", "centered", "fits-range", "headroom"])
    );
    // Headroom is C5 - A4 = 3 semitones, footroom D3 - C3 = 2
    const fits = result.info.reasons.find((r) => r.kind === "fits-range")!;
    expect(fits.detail).toContain("2 semitones to spare at the bottom and 3 semitones at the top");
  });

  test("partial tessitura overlap is measured as a share of the song's band", () => {
    // Song band A3-A4 (12 semis); zone ends at F#4, so A3-F#4 = 9/12 inside
    const t = { t25: v("A3"), t50: v("D4"), t75: v("A4") };
    expect(tessituraOverlap(t, profile)).toBeCloseTo(0.75);
    const song = makeSong({
      vocalRange: "E3 - B4",
      tessitura_low: "A3",
      tessitura_median: "D4",
      tessitura_high: "A4",
    });
    const result = scoreSong(song, profile)!;
    expect(result.info.category).toBe("tessitura");
    expect(result.info.summary).toBe("75% of the melody sits in your comfortable zone.");
  });

  test("fits the range but tessitura sits high -> range pick, not tessitura", () => {
    const song = makeSong({
      vocalRange: "C4 - C5",
      tessitura_low: "G4",
      tessitura_median: "A4",
      tessitura_high: "B4",
    });
    expect(scoreSong(song, profile)!.info.category).toBe("range");
  });

  test("up to 2 semitones out is a stretch pick with a transpose fix", () => {
    const song = makeSong({ vocalRange: "E3 - D5" });
    const result = scoreSong(song, profile)!;
    expect(result.info.category).toBe("stretch");
    expect(result.info.summary).toBe("Just 2 semitones above your range. A good stretch goal.");
    const fix = result.info.reasons.find((r) => r.kind === "stretch-fix")!;
    expect(fix.detail).toBe("Transpose it down 2 semitones and every note lands inside your range.");
  });

  test("stretch below the range is described as below", () => {
    const result = scoreSong(makeSong({ vocalRange: "A#2 - G4" }), profile)!;
    expect(result.info.category).toBe("stretch");
    expect(result.info.summary).toContain("2 semitones below your range");
  });

  test("more than 2 semitones out is never featured", () => {
    expect(scoreSong(makeSong({ vocalRange: "E3 - D#5" }), profile)).toBeNull();
    expect(scoreSong(makeSong({ vocalRange: "A#2 - C#5" }), profile)).toBeNull();
  });

  test("song wider than the user's range gets no transpose fix", () => {
    // B2-C5 is 1 semitone out, but 25 semitones wide vs the user's 24
    const result = scoreSong(makeSong({ vocalRange: "B2 - C5" }), profile)!;
    expect(result.info.category).toBe("stretch");
    expect(result.info.reasons.some((r) => r.kind === "stretch-fix")).toBe(false);
  });

  test("tessitura outside the song's own range is ignored as bad data", () => {
    const song = makeSong({
      vocalRange: "D3 - A4",
      tessitura_low: "G4",
      tessitura_median: "C5",
      tessitura_high: "E5",
    });
    expect(scoreSong(song, profile)!.info.category).toBe("range");
  });

  test("a fitting song outranks a stretch song with the same tessitura", () => {
    const tess = { tessitura_low: "G3", tessitura_median: "A3", tessitura_high: "D4" };
    const fits = scoreSong(makeSong({ vocalRange: "D3 - B4", ...tess }), profile, 0)!;
    const stretch = scoreSong(makeSong({ vocalRange: "D3 - C#5", ...tess }), profile, 1)!;
    expect(fits.score).toBeGreaterThan(stretch.score);
  });

  test("a song matching the range exactly never says 0 semitones", () => {
    const { reasons } = scoreSong(makeSong({ vocalRange: "C3 - C5" }), profile)!.info;
    const fits = reasons.find((r) => r.kind === "fits-range")!;
    expect(fits.detail).toBe("The song runs from C3 to C5, an exact match for your range.");
  });

  test("only the side with room to spare is mentioned", () => {
    const fits = (vocalRange: string) =>
      scoreSong(makeSong({ vocalRange }), profile)!.info.reasons.find((r) => r.kind === "fits-range")!.detail;
    expect(fits("C3 - A4")).toMatch(/inside your range of C3 to C5, with 3 semitones to spare at the top\.$/);
    expect(fits("D3 - C5")).toMatch(/inside your range of C3 to C5, with 2 semitones to spare at the bottom\.$/);
  });
});

describe("section highlights", () => {
  const profile = estimateVoiceProfile("C3", "C5")!; // zone F3 - F#4

  test("a fitting tessitura pick explains both its range and its tessitura", () => {
    const song = makeSong({
      vocalRange: "D3 - A4",
      tessitura_low: "G3",
      tessitura_median: "B3",
      tessitura_high: "D4",
    });
    const { highlights } = scoreSong(song, profile)!.info;
    expect(highlights.range.title).toBe("Fits your range");
    expect(highlights.range.detail).toContain("entirely inside your range of C3 to C5");
    expect(highlights.tessitura!.detail).toContain("is G3 to D4");
    expect(highlights.tessitura!.detail).toContain("all of it is inside your zone");
    expect(highlights.tessitura!.detail).toContain("near the middle of that zone");
  });

  test("a stretch pick's range note says how far out it is, and how to fix it", () => {
    const { highlights } = scoreSong(makeSong({ vocalRange: "E3 - D5" }), profile)!.info;
    expect(highlights.range.title).toBe("Just outside your range");
    expect(highlights.range.detail).toContain("2 semitones above your highest recorded note");
    expect(highlights.range.detail).toContain("Transpose it down 2 semitones");
  });

  test("no tessitura note when the tessitura isn't why it was picked", () => {
    const song = makeSong({
      vocalRange: "C4 - C5",
      tessitura_low: "G4",
      tessitura_median: "A4",
      tessitura_high: "B4",
    });
    expect(scoreSong(song, profile)!.info.highlights.tessitura).toBeUndefined();
    expect(scoreSong(makeSong({ vocalRange: "E3 - G4" }), profile)!.info.highlights.tessitura).toBeUndefined();
  });

  test("voice type matches the Best Fit side it belongs to, blends included", () => {
    const fit = { male: "Tenor", female: "Alto" };
    expect(Object.keys(voiceTypeHighlights("Tenor", fit))).toEqual(["male"]);
    expect(Object.keys(voiceTypeHighlights("Mezzo-Soprano / Alto", fit))).toEqual(["female"]);
    expect(voiceTypeHighlights("tenor", fit).male!.detail).toContain("fits the Tenor voice type best");
  });

  test("no voice type note when it doesn't match or isn't known", () => {
    expect(voiceTypeHighlights("Bass", { male: "Tenor", female: "Alto" })).toEqual({});
    expect(voiceTypeHighlights(null, { male: "Tenor", female: "Alto" })).toEqual({});
  });
});

describe("selectFeaturedSongs", () => {
  const profile = estimateVoiceProfile("C3", "C5")!;
  const tess = { tessitura_low: "G3", tessitura_median: "A3", tessitura_high: "D4" };

  test("tessitura picks come first, stretch last, capped per artist", () => {
    const candidates = [
      ...Array.from({ length: 5 }, (_, i) => makeSong({ name: `T${i}`, artist: `TA${i}`, vocalRange: "D3 - A4", ...tess })),
      ...Array.from({ length: 10 }, (_, i) => makeSong({ name: `R${i}`, artist: `RA${i}`, vocalRange: "E3 - G4" })),
      ...Array.from({ length: 5 }, (_, i) => makeSong({ name: `S${i}`, artist: `SA${i}`, vocalRange: "E3 - C#5" })),
      ...Array.from({ length: 4 }, (_, i) => makeSong({ name: `Same${i}`, artist: "Prolific", vocalRange: "E3 - G4" })),
    ];
    const picks = selectFeaturedSongs(candidates, profile, { random: () => 0 });
    const cats = picks.map((p) => p.info.category);

    expect(picks).toHaveLength(15);
    expect(cats.filter((c) => c === "tessitura")).toHaveLength(5);
    expect(cats.filter((c) => c === "stretch")).toHaveLength(3);
    expect(cats.indexOf("range")).toBeGreaterThan(cats.lastIndexOf("tessitura"));
    expect(cats.indexOf("stretch")).toBeGreaterThan(cats.lastIndexOf("range"));
    expect(picks.filter((p) => p.song.artist === "Prolific").length).toBeLessThanOrEqual(2);
  });

  test("duplicates (same name and artist) are only featured once", () => {
    const a = makeSong({ name: "Dup", artist: "X", vocalRange: "E3 - G4" });
    const b = makeSong({ name: "dup", artist: "x", vocalRange: "E3 - G4" });
    expect(selectFeaturedSongs([a, b], profile)).toHaveLength(1);
  });

  test("unparseable songs are skipped, not crashed on", () => {
    const picks = selectFeaturedSongs(
      [makeSong({ vocalRange: "" }), makeSong({ vocalRange: "nonsense" }), { id: 99 }],
      profile
    );
    expect(picks).toEqual([]);
  });
});
