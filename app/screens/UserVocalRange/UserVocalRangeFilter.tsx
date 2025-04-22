// File Location: app/screens/UserVocalRange/UserVocalRangeFilter.tsx

import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../util/supabase";

export type VocalRange = {
  min_range: string;
  max_range: string;
};

type UserVocalRangeFilterProps = {
  onFilterApply: (filterActive: boolean) => void;
  isDisabled?: boolean;
};

// This component fetches the user's vocal range from the database and applies a filter based on that range.
//  - If the user has not set their vocal range, it shows an alert when the filter is pressed
const UserVocalRangeFilter = ({ onFilterApply }: UserVocalRangeFilterProps) => {
  const [vocalRange, setVocalRange] = useState<VocalRange | null>(null);

  useEffect(() => {
    const fetchUserVocalRange = async () => {
      try {
        const { data: user, error } = await supabase.auth.getUser();
        if (error || !user?.user) {
          return;
        }

        const { data, error: rangeError } = await supabase
          .from("user_vocal_ranges")
          .select("min_range, max_range")
          .eq("user_id", user.user.id)
          .single();

        if (rangeError) {
          console.error("Error fetching vocal range:", rangeError);
        } else {
          setVocalRange(data);
        }
      } catch (err) {
        console.error("Error fetching user vocal range:", err);
      }
    };

    fetchUserVocalRange();
  }, []);

  const handleFilterPress = () => {
    if (vocalRange?.min_range === "C0" || vocalRange?.max_range === "C0") {
      Alert.alert(
        "Vocal Range Not Set",
        "Please set your vocal range in the profile to use this filter."
      );
      return;
    }
    onFilterApply(true);
  };

  const isFilterDisabled =
    !vocalRange || vocalRange.min_range === "C0" || vocalRange.max_range === "C0";

  return (
    <TouchableOpacity
      style={[
        styles.filterButton,
        isFilterDisabled && styles.disabledButton,
      ]}
      onPress={handleFilterPress}
      disabled={isFilterDisabled}
    >
      <Ionicons
        name="filter"
        size={24}
        color={isFilterDisabled ? "#ccc" : "tomato"}
      />
      <Text style={styles.buttonText}>In Range</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 12,
    color: "tomato",
  },
});

export default UserVocalRangeFilter;
