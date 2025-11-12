// File: app/screens/SongDetailsScreen/SongRangeRecommendation.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchUserVocalRange } from "../../util/api";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";

// All musical notes in order from C0 to C7
export const NOTES = [
  "C0",
  "C#0",
  "D0",
  "D#0",
  "E0",
  "F0",
  "F#0",
  "G0",
  "G#0",
  "A0",
  "A#0",
  "B0",
  "C1",
  "C#1",
  "D1",
  "D#1",
  "E1",
  "F1",
  "F#1",
  "G1",
  "G#1",
  "A1",
  "A#1",
  "B1",
  "C2",
  "C#2",
  "D2",
  "D#2",
  "E2",
  "F2",
  "F#2",
  "G2",
  "G#2",
  "A2",
  "A#2",
  "B2",
  "C3",
  "C#3",
  "D3",
  "D#3",
  "E3",
  "F3",
  "F#3",
  "G3",
  "G#3",
  "A3",
  "A#3",
  "B3",
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
  "C#5",
  "D5",
  "D#5",
  "E5",
  "F5",
  "F#5",
  "G5",
  "G#5",
  "A5",
  "A#5",
  "B5",
  "C6",
  "C#6",
  "D6",
  "D#6",
  "E6",
  "F6",
  "F#6",
  "G6",
  "G#6",
  "A6",
  "A#6",
  "B6",
  "C7",
];

// Function to fetch user vocal range from the API
interface SongRangeRecommendationProps {
  songVocalRange: string;
  isLoggedIn: boolean;
}

// Function to fetch user vocal range from the API
const SongRangeRecommendation: React.FC<SongRangeRecommendationProps> = ({
  songVocalRange,
  isLoggedIn,
}) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [userMinRange, setUserMinRange] = useState<string | null>(null);
  const [userMaxRange, setUserMaxRange] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [rangeFeedback, setRangeFeedback] = useState<{
    low: string;
    high: string;
    isFullyInRange: boolean;
    showSetupMessage: boolean;
  } | null>(null);

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    const fetchUserRange = async () => {
      const rangeData = await fetchUserVocalRange();
      if (rangeData) {
        const { min_range, max_range } = rangeData;
        if (min_range !== "C0" && max_range !== "C0") {
          setUserMinRange(min_range);
          setUserMaxRange(max_range);
          calculateRangeFeedback(min_range, max_range, songVocalRange);
        } else {
          setRangeFeedback({
            low: "Set your vocal range in the profile for personalized recommendations.",
            high: "",
            isFullyInRange: false,
            showSetupMessage: true,
          });
        }
      } else {
        setRangeFeedback({
          low: "Set your vocal range in the profile for personalized recommendations.",
          high: "",
          isFullyInRange: false,
          showSetupMessage: true,
        });
      }
    };

    fetchUserRange();
  }, [songVocalRange]);

  // Function to calculate the range feedback based on user and song vocal ranges
  const calculateRangeFeedback = (
    minRange: string,
    maxRange: string,
    songRange: string
  ) => {
    const [songMin, songMax] = songRange.split(" - ");
    if (songMin && songMax) {
      const songMinIndex = NOTES.indexOf(songMin);
      const songMaxIndex = NOTES.indexOf(songMax);
      const userMinIndex = NOTES.indexOf(minRange);
      const userMaxIndex = NOTES.indexOf(maxRange);

      if (songMinIndex >= userMinIndex && songMaxIndex <= userMaxIndex) {
        setRangeFeedback({
          low: "In range! ✅",
          high: "In range! ✅",
          isFullyInRange: true,
          showSetupMessage: false,
        });
      } else {
        const lowFeedback =
          songMinIndex < userMinIndex
            ? `Too low by ${userMinIndex - songMinIndex} notes`
            : "In range! ✅";

        const highFeedback =
          songMaxIndex > userMaxIndex
            ? `Too high by ${songMaxIndex - userMaxIndex} notes`
            : "In range! ✅";

        setRangeFeedback({
          low: lowFeedback,
          high: highFeedback,
          isFullyInRange: false,
          showSetupMessage: false,
        });
      }
    } else {
      setRangeFeedback({
        low: "Invalid song vocal range provided.",
        high: "",
        isFullyInRange: false,
        showSetupMessage: false,
      });
    }
  };
  
  // Function to toggle the expanded state of the component
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleSetupPress = () => {
    if (isLoggedIn) {
      // @ts-ignore
      navigation.navigate("Profile");
    } else {
      // @ts-ignore
      navigation.navigate("Home");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <TouchableOpacity onPress={toggleExpand} style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Personalized Recommendation</Text>
        <Text style={[styles.expandText, { color: colors.textSecondary }]}>{isExpanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {isExpanded && rangeFeedback && (
        <View style={styles.content}>
          {rangeFeedback.showSetupMessage ? (
            <>
              <Text style={[styles.setupMessage, { color: colors.textSecondary }]}>
                Set your vocal range for a personalized recommendation.
              </Text>
              <TouchableOpacity style={[styles.setupButton, { backgroundColor: colors.primary }]} onPress={handleSetupPress}>
                <Text style={styles.setupButtonText}>Set Your Range</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.userRangeText, { color: colors.textPrimary }]}>
                Your Vocal Range: {userMinRange} - {userMaxRange}
              </Text>
              <View style={styles.feedbackItem}>
                <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Low:</Text>
                <Text style={[styles.feedbackText, rangeFeedback.low.includes('In range') ? { color: colors.primary } : { color: colors.danger }]}>
                  {rangeFeedback.low}
                </Text>
              </View>
              <View style={styles.feedbackItem}>
                <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>High:</Text>
                <Text style={[styles.feedbackText, rangeFeedback.high.includes('In range') ? { color: colors.primary } : { color: colors.danger }]}>
                  {rangeFeedback.high}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
  expandText: {
    fontSize: 20,
    fontFamily: FONTS.primary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userRangeText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  feedbackLabel: {
    fontSize: 16,
    fontFamily: FONTS.primary,
    width: 60,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    flex: 1,
  },
  setupMessage: {
    fontSize: 16,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginVertical: 10,
  },
  setupButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  setupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
});

export default SongRangeRecommendation;
