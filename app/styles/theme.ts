// app/styles/theme.ts

// Light theme colors
export const LightColors = {
  // Backgrounds
  background: '#f9f9f9',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#F5F5F5',
  backgroundCard: '#FFFFFF',
  
  // Text
  textPrimary: '#333',
  textSecondary: '#666',
  textTertiary: '#888',
  textPlaceholder: '#999',
  textInverse: '#fff',
  
  // Borders
  border: '#ddd',
  borderLight: '#e0e0e0',
  
  // Brand colors
  primary: 'tomato',          // #ff6347
  primaryDark: '#ff6600',
  secondary: '#1e90ff',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#ff4444',
  dangerDark: '#f44336',
  
  // UI elements
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#d9d9d9',
  
  // Special colors
  accent: '#e91e63',
  link: '#007bff',
  highlight: '#fff5f5',
  highlightAlt: '#FFF0ED',
  
  // Specific UI colors
  inputBackground: '#f9f9f9',
  buttonText: '#fff',
  tabSelected: '#fff5f5',
  tabDisabled: '#555',
  tabBorder: '#777',
  green: '#32CD32',
  greenDark: '#4caf50',
  gold: '#ffaa00',
  gray: 'gray',
  lightGray: '#f0f0f0',
  darkGray: '#ccc',
};

// Dark theme colors
export const DarkColors = {
  // Backgrounds
  background: '#051629',
  backgroundSecondary: '#051629',
  backgroundTertiary: '#0a2540',
  backgroundCard: '#0a2540',
  
  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textPlaceholder: '#666',
  textInverse: '#121212',
  
  // Borders
  border: '#404040',
  borderLight: '#333333',
  
  // Brand colors (slightly adjusted for dark mode)
  primary: '#ff6b52',
  primaryDark: '#ff7733',
  secondary: '#4da6ff',
  success: '#66bb6a',
  warning: '#ffa726',
  danger: '#ff5555',
  dangerDark: '#ff6666',
  
  // UI elements
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  disabled: '#444444',
  
  // Special colors
  accent: '#ff4081',
  link: '#42a5f5',
  highlight: '#332222',
  highlightAlt: '#3a2622',
  
  // Specific UI colors
  inputBackground: '#2a2a2a',
  buttonText: '#fff',
  tabSelected: '#2a1a1a',
  tabDisabled: '#555',
  tabBorder: '#666',
  green: '#4caf50',
  greenDark: '#66bb6a',
  gold: '#ffc107',
  gray: '#999',
  lightGray: '#333',
  darkGray: '#555',
};

// Legacy exports for backward compatibility
export const COLORS = {
  primary: "tomato",
  secondary: "#1e90ff",
  background: "#f9f9f9",
  textDark: "#333",
  textLight: "#666",
  border: "#ddd",
  success: "#4CAF50",
};

export const FONTS = {
  primary: "Roboto", // might change later
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
