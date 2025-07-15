
// app/components/Piano/Piano.tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { COLORS, FONTS } from '../../styles/theme';
import { noteToValue } from '../../util/vocalRange';

const { width } = Dimensions.get('window');
const WHITE_KEY_WIDTH = width / 15;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.6;

const NOTES = [
  'C0', 'C#0', 'D0', 'D#0', 'E0', 'F0', 'F#0', 'G0', 'G#0', 'A0', 'A#0', 'B0',
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
  'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6', 'F#6', 'G6', 'G#6', 'A6', 'A#6', 'B6',
  'C7', 'C#7', 'D7', 'D#7', 'E7', 'F7', 'F#7', 'G7', 'G#7', 'A7', 'A#7', 'B7',
  'C8'
];

const Piano = ({ vocalRange }: { vocalRange: string }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [lowNote, highNote] = vocalRange.split(' - ');

  const lowNoteValue = noteToValue(lowNote);
  const highNoteValue = noteToValue(highNote);

  const whiteKeys = NOTES.filter(note => !note.includes('#'));

  useEffect(() => {
    if (scrollViewRef.current && lowNoteValue) {
      const lowNoteIndex = whiteKeys.findIndex(note => noteToValue(note) >= lowNoteValue);
      if (lowNoteIndex !== -1) {
        const xOffset = lowNoteIndex * WHITE_KEY_WIDTH - WHITE_KEY_WIDTH * 2; // Center the key
        scrollViewRef.current.scrollTo({ x: xOffset, animated: true });
      }
    }
  }, [lowNoteValue, whiteKeys]);

  const renderKeys = () => {
    let whiteKeyIndex = 0;
    return NOTES.map((note, index) => {
      const isBlackKey = note.includes('#');
      const isLowNote = note === lowNote;
      const isHighNote = note === highNote;

      if (isBlackKey) {
        return (
          <View
            key={note}
            style={[
              styles.blackKey,
              { left: (whiteKeyIndex - 0.5) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 },
              isLowNote && styles.highlightedBlackKey,
              isHighNote && styles.highlightedBlackKey,
            ]}
          >
            <Text style={styles.blackKeyLabel}>{note}</Text>
          </View>
        );
      } else {
        whiteKeyIndex++;
        return (
          <View
            key={note}
            style={[
              styles.whiteKey,
              isLowNote && styles.highlightedWhiteKey,
              isHighNote && styles.highlightedWhiteKey,
            ]}
          >
            <Text style={styles.whiteKeyLabel}>{note}</Text>
          </View>
        );
      }
    });
  };

  return (
    <View style={styles.pianoContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.piano}
      >
        {renderKeys()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  pianoContainer: {
    height: 150,
    marginVertical: 20,
  },
  piano: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  whiteKey: {
    width: WHITE_KEY_WIDTH,
    height: 150,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 10,
  },
  blackKey: {
    position: 'absolute',
    width: BLACK_KEY_WIDTH,
    height: 90,
    backgroundColor: COLORS.textDark,
    zIndex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
  },
  whiteKeyLabel: {
    color: COLORS.textDark,
    fontSize: 12,
  },
  blackKeyLabel: {
    color: 'white',
    fontSize: 10,
  },
  highlightedWhiteKey: {
    backgroundColor: COLORS.primary,
  },
  highlightedBlackKey: {
    backgroundColor: COLORS.primary,
  },
});

export default Piano;
