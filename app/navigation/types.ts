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
  };
  AddSong: undefined;
  SavedLists: undefined;
  ListDetails: { listName: string };
  SongDetails: { name: string; artist: string; vocalRange: string };
  Metronome: undefined;
  AdminProfileScreen: undefined;
  AdminAnalyticsScreen: undefined;
  ContentModerationScreen: undefined;
  ForgotPassword: undefined;
};
