// mockBackend.js

const mockSongs = [
  { id: 1, name: "Hello", vocalRange: "C3 - G5", artist: "Adele" },
  { id: 2, name: "Someone Like You", vocalRange: "D3 - A5", artist: "Adele" },
  { id: 3, name: "Bohemian Rhapsody", vocalRange: "F2 - G5", artist: "Queen" },
  {
    id: 4,
    name: "I Will Always Love You",
    vocalRange: "C3 - F#5",
    artist: "Whitney Houston",
  },
  { id: 5, name: "Uptown Funk", vocalRange: "C3 - C6", artist: "Bruno Mars" },
  {
    id: 6,
    name: "Billie Jean",
    vocalRange: "E2 - G5",
    artist: "Michael Jackson",
  },
  { id: 7, name: "Yesterday", vocalRange: "D3 - E5", artist: "The Beatles" },
  { id: 8, name: "Shallow", vocalRange: "C3 - G5", artist: "Lady Gaga" },
  {
    id: 9,
    name: "Rolling in the Deep",
    vocalRange: "C3 - E5",
    artist: "Adele",
  },
  { id: 10, name: "Let It Be", vocalRange: "C3 - E5", artist: "The Beatles" },
  { id: 11, name: "Shape of You", vocalRange: "D3 - F5", artist: "Ed Sheeran" },
  { id: 12, name: "Perfect", vocalRange: "C3 - G4", artist: "Ed Sheeran" },
  { id: 13, name: "Chandelier", vocalRange: "A3 - E6", artist: "Sia" },
  {
    id: 14,
    name: "Hallelujah",
    vocalRange: "G2 - C5",
    artist: "Leonard Cohen",
  },
  {
    id: 15,
    name: "Someone You Loved",
    vocalRange: "G3 - E5",
    artist: "Lewis Capaldi",
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
