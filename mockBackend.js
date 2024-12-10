// mockBackend.js

const mockData = [
  { id: 1, name: "Adele", vocalRange: "C3 - F5", type: "artist" },
  { id: 2, name: "Hello", vocalRange: "C3 - G5", type: "song" },
  { id: 3, name: "Freddie Mercury", vocalRange: "F2 - F6", type: "artist" },
  { id: 4, name: "Bohemian Rhapsody", vocalRange: "F2 - G5", type: "song" },
  { id: 5, name: "Bruno Mars", vocalRange: "C3 - C6", type: "artist" },
];

export const searchArtists = (query) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!query) {
        resolve(mockData); // Return all data if no query
      } else {
        const results = mockData.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase())
        );
        resolve(results);
      }
    }, 500); // Simulate network latency
  });
};
