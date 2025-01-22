// File: app/util/RangeBestFit.tsx

export const noteToValue = (note: string): number => {
  const scale: { [key: string]: number } = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const octave = parseInt(note.slice(-1), 10);
  const key = note.slice(0, -1);

  return scale[key] + (octave + 1) * 12;
};

export const findClosestVocalRangeFit = (
  range: string
): {
  male: string;
  female: string;
  maleOutOfRange: string | null;
  femaleOutOfRange: string | null;
} => {
  const [minRange, maxRange] = range.split(" - ").map(noteToValue);

  // Define standard vocal ranges
  const vocalRanges = {
    male: [
      { category: "Tenor", min: noteToValue("C3"), max: noteToValue("A4") },
      { category: "Baritone", min: noteToValue("A2"), max: noteToValue("F4") },
      { category: "Bass", min: noteToValue("E2"), max: noteToValue("E4") },
    ],
    female: [
      { category: "Soprano", min: noteToValue("C4"), max: noteToValue("A5") },
      {
        category: "Mezzo-Soprano",
        min: noteToValue("A3"),
        max: noteToValue("F5"),
      },
      { category: "Alto", min: noteToValue("F3"), max: noteToValue("D5") },
    ],
  };

  // Helper function to find best fit and out-of-range conditions
  const findBestFit = (
    ranges: { category: string; min: number; max: number }[]
  ): { category: string; outOfRange: string | null } => {
    let bestFit = "Unknown";
    let highestCoverage = 0;
    let outOfRange: string | null = null;

    ranges.forEach(({ category, min, max }) => {
      const coverage = Math.max(
        0,
        Math.min(max, maxRange) - Math.max(min, minRange)
      );

      // If we find a better fit, update bestFit and reset outOfRange
      if (coverage > highestCoverage) {
        bestFit = category;
        highestCoverage = coverage;
        outOfRange = null; // Reset out-of-range when we find overlap
      }

      // Check for partial or complete out-of-range cases
      if (coverage > 0) {
        if (minRange < min) outOfRange = "lower"; // Partially lower
        if (maxRange > max) outOfRange = "higher"; // Partially higher
      } else {
        // Fully out of range: check if it's lower or higher
        if (minRange < min && maxRange > max) {
          outOfRange = "both"; // Completely outside
        } else if (minRange < min) {
          outOfRange = "lower"; // Too low
        } else if (maxRange > max) {
          outOfRange = "higher"; // Too high
        }
      }
    });

    // Ensure a fallback return value for fully unmatched cases
    return {
      category: bestFit,
      outOfRange: outOfRange,
    };
  };

  const male = findBestFit(vocalRanges.male);
  const female = findBestFit(vocalRanges.female);

  return {
    male: male.category,
    female: female.category,

    maleOutOfRange: male.outOfRange,
    femaleOutOfRange: female.outOfRange,
  };
};
