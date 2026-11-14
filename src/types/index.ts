export interface PlaylistItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artwork?: string;
  file?: File;
  url?: string;
  liked?: boolean;
  /** Original file name (with extension), used to find the song again after a refresh. */
  fileName?: string;
  /** Path relative to the music folder this song was imported from (e.g. "Album/song.mp3"). */
  relativePath?: string;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: Date;
}

export interface RecentlyPlayedItem {
  duration: number;
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  playedAt: Date;
}


