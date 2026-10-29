/**
 * Tests for app/navigation/stackNav.ts
 *
 * The Song Details and Artist Details screens link to each other. Under
 * React Navigation 7 a plain `navigate` pushes a new copy of a screen unless
 * it is the focused one, so that loop used to grow the stack forever and the
 * header back button walked back through every hop instead of returning to
 * the Search screen. These tests pin the reuse rule that stops it.
 */

import { goToStackScreen, isSameArtist, isSameSong } from "../../app/navigation/stackNav";

type Route = { name: string; params?: object };

const makeNavigation = (routes: Route[]) => {
  const navigate = jest.fn();
  const dispatch = jest.fn();
  return {
    navigate,
    dispatch,
    getState: () => ({ routes }),
  };
};

describe("goToStackScreen", () => {
  it("pushes when the screen is not in the stack", () => {
    const nav = makeNavigation([{ name: "Search" }]);

    goToStackScreen(nav, "ArtistDetails", { name: "Adele" }, (p) =>
      isSameArtist(p, "Adele")
    );

    expect(nav.navigate).toHaveBeenCalledWith("ArtistDetails", { name: "Adele" });
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("pops back to the existing screen when it shows the same thing", () => {
    // Search -> ArtistDetails(Adele) -> Details(song): tapping the artist
    // name should return to the artist screen already below, not stack a
    // second copy of it.
    const nav = makeNavigation([
      { name: "Search" },
      { name: "ArtistDetails", params: { name: "Adele" } },
      { name: "Details", params: { name: "Hello", artist: "Adele" } },
    ]);

    goToStackScreen(nav, "ArtistDetails", { name: "Adele" }, (p) =>
      isSameArtist(p, "Adele")
    );

    expect(nav.navigate).not.toHaveBeenCalled();
    expect(nav.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "POP_TO",
        payload: expect.objectContaining({ name: "ArtistDetails" }),
      })
    );
  });

  it("pushes when the screen in the stack is showing something else", () => {
    const nav = makeNavigation([
      { name: "Search" },
      { name: "ArtistDetails", params: { name: "Adele" } },
    ]);

    goToStackScreen(nav, "Details", { name: "Hello", artist: "Adele" }, (p) =>
      isSameSong(p, { name: "Hello", artist: "Adele" })
    );

    expect(nav.navigate).toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("only considers the last copy of a screen, never an earlier one", () => {
    // A stale Details lower down must not drag the user back past the
    // artist screen they are actually looking at.
    const nav = makeNavigation([
      { name: "Search" },
      { name: "Details", params: { name: "Hello", artist: "Adele" } },
      { name: "ArtistDetails", params: { name: "Adele" } },
      { name: "Details", params: { name: "Easy On Me", artist: "Adele" } },
    ]);

    goToStackScreen(nav, "Details", { name: "Hello", artist: "Adele" }, (p) =>
      isSameSong(p, { name: "Hello", artist: "Adele" })
    );

    expect(nav.navigate).toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("pushes when the navigator cannot report its state", () => {
    const nav = { navigate: jest.fn(), dispatch: jest.fn() };

    goToStackScreen(nav, "ArtistDetails", { name: "Adele" }, () => true);

    expect(nav.navigate).toHaveBeenCalledWith("ArtistDetails", { name: "Adele" });
  });
});
