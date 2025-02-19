// file location: app/screens/UserVocalRangeLogic/UserVocalRangeLogic.tsx

import { Alert } from "react-native";
import { supabase } from "../../util/supabase";

export const submitVocalRange = async (minRange: string, maxRange: string) => {
  // Validate input: only A-G, optional #, and octave 0-8
  const validNote = /^[A-G]#?[0-8]$/;
  if (!validNote.test(minRange) || !validNote.test(maxRange)) {
    Alert.alert(
      "Error",
      "Enter a valid note (A-G, optional #, and octave 0-8)."
    );
    return;
  }

  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    Alert.alert("Error", "You must be logged in to submit a vocal range.");
    return;
  }

  // Use upsert to insert or update the user's vocal range
  const { error } = await supabase.from("user_vocal_ranges").upsert(
    [
      {
        user_id: user.user.id,
        min_range: minRange,
        max_range: maxRange,
      },
    ],
    { onConflict: "user_id" } // Ensures only one row per user_id
  );

  if (error) {
    console.error("Error submitting vocal range:", error);
    Alert.alert("Error", "Could not submit vocal range.");
  } else {
    Alert.alert("Success", "Your vocal range has been saved!");
  }
};
