// app/util/api.ts

import { searchArtists } from "../../mockBackend"; // Use your mock backend

// Define the type for search results
interface SearchResult {
  id: number;
  name: string;
  vocalRange: string;
  type: "artist" | "song";
}

export const searchArtistsOrSongs = async (
  query: string,
  filter: "artists" | "songs"
): Promise<SearchResult[]> => {
  try {
    const results: SearchResult[] = await searchArtists(query); // Fetch mock data

    // Filter based on "artists" or "songs"
    if (filter === "artists") {
      return results.filter((item: SearchResult) => item.type === "artist");
    } else if (filter === "songs") {
      return results.filter((item: SearchResult) => item.type === "song");
    }

    return results;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};
