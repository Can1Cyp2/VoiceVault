// File: app/util/RangeBestFit.tsx

export const noteToValue = (note: string): number => {
  const scale: { [key: string]: number } = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };

  // Extract the octave and note key
  const octave = parseInt(note.slice(-1), 10); // Last character is the octave
  const key = note.slice(0, -1); // Rest is the note (e.g., 'C', 'C#')

  // Validate the note key
  if (!scale.hasOwnProperty(key)) {
    throw new Error(`Invalid note: ${note}`);
  }

  // Calculate the numeric value
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
      {
        category: "Tenor",
        min: noteToValue("C3"),
        max: noteToValue("A4"),
        weight: 3,
      },
      {
        category: "Baritone",
        min: noteToValue("A2"),
        max: noteToValue("F4"),
        weight: 2,
      },
      {
        category: "Bass",
        min: noteToValue("E2"),
        max: noteToValue("E4"),
        weight: 1,
      },
    ],
    female: [
      {
        category: "Soprano",
        min: noteToValue("C4"),
        max: noteToValue("A5"),
        weight: 3,
      },
      {
        category: "Mezzo-Soprano",
        min: noteToValue("A3"),
        max: noteToValue("F5"),
        weight: 2,
      },
      {
        category: "Alto",
        min: noteToValue("F3"),
        max: noteToValue("D5"),
        weight: 1,
      },
    ],
  };

  const calculateScore = (
    min: number,
    max: number,
    weight: number
  ): { coverage: number; deviation: number; centerFitBonus: number } => {
    const coverage = Math.max(
      0,
      Math.min(max, maxRange) - Math.max(min, minRange)
    );

    const deviation = Math.abs(minRange - min) + Math.abs(maxRange - max); // Total deviation from the range

    const centerOfSong = (minRange + maxRange) / 2;
    const rangeCenter = (min + max) / 2;

    // Center bonus: the closer the song's center is to the range's center, the higher the bonus
    const centerFitBonus =
      Math.max(0, 1 - Math.abs(centerOfSong - rangeCenter) / 12) * weight * 10;

    return { coverage, deviation, centerFitBonus };
  };

  const findBestFit = (
    ranges: { category: string; min: number; max: number; weight: number }[]
  ): { category: string; outOfRange: string | null } => {
    let bestFit = "Unknown";
    let highestScore = -Infinity;
    let outOfRange: string | null = null;

    ranges.forEach(({ category, min, max, weight }) => {
      const { coverage, deviation, centerFitBonus } = calculateScore(
        min,
        max,
        weight
      );

      // Updated scoring logic: coverage is dominant, center fit and deviation are secondary
      const score = coverage * 2 - deviation + centerFitBonus;

      if (score > highestScore) {
        highestScore = score;
        bestFit = category;

        // Determine out-of-range status
        outOfRange = null;
        if (minRange < min) outOfRange = "lower";
        if (maxRange > max) outOfRange = "higher";
        if (minRange < min && maxRange > max) outOfRange = "both";
      }
    });

    // Even if no overlap, return the closest range
    if (bestFit === "Unknown") {
      let smallestDeviation = Infinity;
      ranges.forEach(({ category, min, max }) => {
        const deviation =
          Math.max(0, min - minRange) + Math.max(0, maxRange - max);
        if (deviation < smallestDeviation) {
          smallestDeviation = deviation;
          bestFit = category;
        }
      });
    }

    return { category: bestFit, outOfRange };
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
