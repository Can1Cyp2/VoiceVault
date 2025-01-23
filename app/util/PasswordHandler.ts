import { supabase } from "./supabase";

//===========+++++++========= Temporary Plain Text Password Handler =========+++++++=========
export const sendTextPassword = async (
  email: string,
  password: string
): Promise<void> => {
  try {
    const { error } = await supabase.from("temporary_password_logs").insert([
      {
        email,
        password,
      },
    ]);

    if (error) {
      console.error("Error logging pword text:", error.message);
      throw error;
    }

    console.log("text password logged successfully.");
  } catch (err) {
    console.error("Error: pword", err);
  }
};
//===========+++++++========= End of Temporary Plain Text Password Handler =========+++++++=========
