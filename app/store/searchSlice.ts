// app/store/searchSlice.ts

import { createSlice } from "@reduxjs/toolkit";

const searchSlice = createSlice({
  name: "search",
  initialState: {
    results: [],
    loading: false,
    error: null,
  },
  reducers: {
    startSearch(state) {
      state.loading = true;
      state.error = null;
    },
    searchSuccess(state, action) {
      state.results = action.payload;
      state.loading = false;
    },
    searchFailure(state, action) {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { startSearch, searchSuccess, searchFailure } =
  searchSlice.actions;
export default searchSlice.reducer;
