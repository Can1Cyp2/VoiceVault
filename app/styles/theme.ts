// app/styles/theme.ts
export const COLORS = {
  primary: "tomato",
  secondary: "#1e90ff",
  background: "#f9f9f9",
  textDark: "#333",
  textLight: "#666",
  border: "#ddd",
};

export const FONTS = {
  primary: "Roboto", // Replace with your preferred font family
};

export const SHARED_STYLES = {
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.background,
  },
  text: {
    fontSize: 16,
    color: COLORS.textDark,
  },
};
