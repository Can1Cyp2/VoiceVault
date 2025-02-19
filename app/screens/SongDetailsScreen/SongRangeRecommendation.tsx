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
import { fetchUserVocalRange } from "../../util/api";

interface SongRangeRecommendationProps {
  songVocalRange: string;
}

const SongRangeRecommendation: React.FC<SongRangeRecommendationProps> = ({
  songVocalRange,
}) => {
  const [userMinRange, setUserMinRange] = useState<string | null>(null);
  const [userMaxRange, setUserMaxRange] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
          calculateRecommendation(min_range, max_range, songVocalRange);
        } else {
          setRecommendation(
            "Set your vocal range in the profile to receive personalized recommendations."
          );
        }
      } else {
        setRecommendation(
          "Set your vocal range in the profile to receive personalized recommendations."
        );
      }
    };

    fetchUserRange();
  }, [songVocalRange]);

  const calculateRecommendation = (
    minRange: string,
    maxRange: string,
    songRange: string
  ) => {
    const [songMin, songMax] = songRange.split(" - ");
    if (songMin && songMax) {
      if (songMin >= minRange && songMax <= maxRange) {
        setRecommendation("This song is within your vocal range!");
      } else {
        const outOfRangeMessage =
          songMin < minRange
            ? `The song goes lower than your range by ${minRange} to ${songMin}. `
            : "";
        const higherOutOfRangeMessage =
          songMax > maxRange
            ? `The song goes higher than your range by ${songMax} to ${maxRange}.`
            : "";
        setRecommendation(
          `This song is out of your vocal range. ${outOfRangeMessage}${higherOutOfRangeMessage}`
        );
      }
    } else {
      setRecommendation("Invalid song vocal range provided.");
    }
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpand} style={styles.header}>
        <Text style={styles.title}>Personalized Recommendation</Text>
        <Text style={styles.expandText}>{isExpanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.recommendationText}>
            {recommendation || "Loading..."}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "lightgray",
    backgroundColor: "#f9f9f9",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  expandText: {
    fontSize: 18,
    color: "gray",
  },
  content: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  recommendationText: {
    fontSize: 16,
    color: "#555",
  },
});

export default SongRangeRecommendation;
