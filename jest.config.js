/**
 * Jest configuration for VoiceVault.
 *
 * Uses the `jest-expo` preset so React Native / Expo modules are transformed
 * and mocked correctly. All tests live in the top-level `tests/` folder:
 *
 *   tests/unit         - pure logic (note math, range analysis, reducers, ...)
 *   tests/integration  - modules exercised against a mocked Supabase backend
 *   tests/helpers      - shared factories and the Supabase mock
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  // jest-expo's default list, plus immer/@reduxjs which ship untranspiled ESM.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|immer|@reduxjs/.*))",
  ],
};
