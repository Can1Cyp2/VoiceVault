// mockBackend.js

const mockSongs = [
  { id: 1, name: "Hello", vocalRange: "C3 - G5", artist: "Adele" },
  { id: 2, name: "Someone Like You", vocalRange: "D3 - A5", artist: "Adele" },
  { id: 3, name: "Bohemian Rhapsody", vocalRange: "F2 - G5", artist: "Queen" },
  { id: 4, name: "Uptown Funk", vocalRange: "C3 - C6", artist: "Bruno Mars" },
  {
    id: 5,
    name: "Just the Way You Are",
    vocalRange: "C3 - C5",
    artist: "Bruno Mars",
  },
];

// Simulate searching for songs and filtering by query
export const searchSongs = (query) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!query) {
        resolve(mockSongs); // Return all songs if no query
      } else {
        const results = mockSongs.filter(
          (item) =>
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            item.artist.toLowerCase().includes(query.toLowerCase())
        );
        resolve(results);
      }
    }, 500); // Simulate network latency
  });
};
