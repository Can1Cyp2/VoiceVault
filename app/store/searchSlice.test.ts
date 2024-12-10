import searchReducer, {
  searchSuccess,
  startSearch,
  searchFailure,
} from "./searchSlice";

describe("searchSlice", () => {
  it("should handle startSearch", () => {
    const previousState = { results: [], loading: false, error: null };
    const newState = searchReducer(previousState, startSearch());
    expect(newState.loading).toBe(true);
    expect(newState.error).toBeNull();
  });

  it("should handle searchSuccess", () => {
    const previousState = { results: [], loading: true, error: null };
    const newState = searchReducer(
      previousState,
      searchSuccess([{ id: 1, name: "Artist" }])
    );
    expect(newState.results).toEqual([{ id: 1, name: "Artist" }]);
    expect(newState.loading).toBe(false);
  });

  it("should handle searchFailure", () => {
    const previousState = { results: [], loading: true, error: null };
    const errorMessage = "Error fetching data";
    const newState = searchReducer(previousState, searchFailure(errorMessage));
    expect(newState.error).toBe(errorMessage);
    expect(newState.loading).toBe(false);
  });
});
