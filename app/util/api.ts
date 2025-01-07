// app/util/api.ts

import { searchSongs } from "../../mockBackend";

export interface Song {
  id: number;
  name: string;
  vocalRange: string;
  artist: string;
}

// Search for songs based on a query
export const searchSongsByQuery = async (query: string): Promise<Song[]> => {
  try {
    const results = await searchSongs(query); // Query the mock backend
    return results;
  } catch (error) {
    console.error("Error fetching songs:", error);
    throw error;
  }
};

// Get a list of artists (filtered dynamically from songs)
export const getArtists = async (
  query: string
): Promise<{ id: number; name: string }[]> => {
  try {
    // Get all songs
    const allSongs = await searchSongs(query);

    // Extract unique artists
    const artists: string[] = allSongs
      .map((song: Song) => song.artist)
      .filter(
        (artist: string, index: number, self: string[]) =>
          self.indexOf(artist) === index
      ); // Remove duplicates

    // Filter artists based on the query
    const filteredArtists = artists.filter((artist) =>
      artist.toLowerCase().includes(query.toLowerCase())
    );

    // Map artists to a format suitable for display
    return filteredArtists.map((artist, index) => ({
      id: index + 1,
      name: artist,
    }));
  } catch (error) {
    console.error("Error fetching artists:", error);
    throw error;
  }
};
