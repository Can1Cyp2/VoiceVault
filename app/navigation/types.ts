// app/navigation/types.ts

export type RootStackParamList = {
  Search: undefined;
  Details: {
    name: string;
    vocalRange: string;
    type: "artist" | "song";
    artist: string | null;
  };
  ArtistDetails: {
    name: string;
  }; // Add ArtistDetails screen with a name parameter
};
