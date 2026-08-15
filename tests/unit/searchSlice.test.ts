/**
 * Tests for app/store/searchSlice.ts
 *
 * Covers the Redux search state machine: loading, success, and failure
 * transitions. (Supersedes the old app/store/searchSlice.test.ts.)
 */

import searchReducer, {
  startSearch,
  searchSuccess,
  searchFailure,
} from "../../app/store/searchSlice";

const initialState = { results: [], loading: false, error: null };

describe("searchSlice", () => {
  it("provides the initial state", () => {
    expect(searchReducer(undefined, { type: "@@INIT" })).toEqual(initialState);
  });

  it("ignores unrelated actions", () => {
    const state = { results: [{ id: 1 }], loading: false, error: null };
    expect(searchReducer(state as any, { type: "something/else" })).toEqual(state);
  });

  describe("startSearch", () => {
    it("sets loading", () => {
      const state = searchReducer(initialState, startSearch());
      expect(state.loading).toBe(true);
    });

    it("clears a previous error", () => {
      const errored = { results: [], loading: false, error: "boom" };
      const state = searchReducer(errored as any, startSearch());
      expect(state.error).toBeNull();
    });

    it("keeps previous results visible while a new search loads", () => {
      const withResults = { results: [{ id: 1 }], loading: false, error: null };
      const state = searchReducer(withResults as any, startSearch());
      expect(state.results).toEqual([{ id: 1 }]);
    });
  });

  describe("searchSuccess", () => {
    it("stores the results and stops loading", () => {
      const loading = { results: [], loading: true, error: null };
      const results = [{ id: 1, name: "Queen" }];

      const state = searchReducer(loading, searchSuccess(results));

      expect(state.results).toEqual(results);
      expect(state.loading).toBe(false);
    });

    it("replaces previous results rather than appending", () => {
      const previous = { results: [{ id: 1 }], loading: true, error: null };
      const state = searchReducer(previous as any, searchSuccess([{ id: 2 }]));
      expect(state.results).toEqual([{ id: 2 }]);
    });
  });

  describe("searchFailure", () => {
    it("stores the error and stops loading", () => {
      const loading = { results: [], loading: true, error: null };
      const state = searchReducer(loading, searchFailure("Network request failed"));

      expect(state.error).toBe("Network request failed");
      expect(state.loading).toBe(false);
    });

    it("keeps the last good results", () => {
      const previous = { results: [{ id: 1 }], loading: true, error: null };
      const state = searchReducer(previous as any, searchFailure("boom"));
      expect(state.results).toEqual([{ id: 1 }]);
    });
  });
});
