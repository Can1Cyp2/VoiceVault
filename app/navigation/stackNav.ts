// app/navigation/stackNav.ts
//
// Helpers for moving between screens of the Search stack without letting it
// grow forever.
//
// Background: React Navigation 7 changed `navigate` so it only reuses a
// screen when that screen is the FOCUSED one - otherwise it pushes a new
// copy (see StackRouter's NAVIGATE case). Song Details and Artist Details
// link to each other, so the old `navigate` calls turned a couple of taps
// into Search -> Artist -> Song -> Artist -> Song ... and the header back
// button had to walk back through every hop instead of returning to Search.
// That is the "back button doesn't go back to search" report.
//
// `popTo` is the v7 way to return to an existing screen, but on its own it
// is not a drop-in either: when no matching screen is in the stack it
// REPLACES the current one instead of pushing. So we look at the stack
// first and only pop when the screen we want is genuinely already there.

import { StackActions } from "@react-navigation/native";

type StackAwareNavigation = {
  getState?: () => { routes: { name: string; params?: object }[] } | undefined;
  dispatch: (action: any) => void;
  navigate: (...args: any[]) => void;
};

/**
 * Go to `name`, reusing the copy already in the stack when it is showing the
 * same thing (`isSameTarget` decides that from its params), and pushing a
 * fresh screen otherwise.
 *
 * Reusing means the intermediate screens are popped, so back always leads
 * somewhere the user has not just been.
 */
export const goToStackScreen = (
  navigation: StackAwareNavigation,
  name: string,
  params: Record<string, unknown>,
  isSameTarget: (existingParams: any) => boolean
): void => {
  const routes = navigation.getState?.()?.routes ?? [];

  // popTo walks down from the current screen and stops at the first match by
  // name, so only the LAST copy is a candidate - matching an earlier one
  // would pop somewhere the user did not ask for.
  const existing = [...routes].reverse().find((route) => route.name === name);

  if (existing && isSameTarget(existing.params ?? {})) {
    navigation.dispatch(StackActions.popTo(name, params));
    return;
  }

  navigation.navigate(name, params);
};

/** Song Details identity: the same song by the same artist. */
export const isSameSong = (
  params: any,
  song: { name: string; artist: string }
): boolean => params?.name === song.name && params?.artist === song.artist;

/** Artist Details identity: just the artist name. */
export const isSameArtist = (params: any, artistName: string): boolean =>
  params?.name === artistName;
