# BroomPlayer

A local-first music player built with React, TypeScript, Tailwind CSS, and Vite.
It plays audio files from your own computer — nothing is uploaded to any server.
Playlists, recently-played history, and liked songs are saved locally in your
browser (IndexedDB / localStorage), so your library survives a page refresh.

## What it is

- **Plays local audio files** — MP3, WAV, FLAC, M4A, OGG, AAC.
- **Two ways to import:**
  - *Open Music Folder* — picks a whole folder (uses the File System Access API
    on Chromium browsers; falls back to a folder picker on Firefox / Safari).
  - *Open Music File* — picks individual files.
- **Playlists** — create, rename, delete, and organize songs into playlists.
- **Recently Played** — quick access to the tracks you listened to last.
- **Liked Songs** — heart the track you're currently playing.
- **Search** — search across all your songs and playlists.
- **Missing-song recovery** — if a song's file disappears after a refresh,
  BroomPlayer asks you to reconnect the folder (or removes the song).

## Features

- Full play / pause, next / previous, shuffle, repeat.
- Click or drag the progress bar to seek; a volume slider on the right.
- Dark, flat UI with a single green accent — no gradients, no clutter.
- Responsive layout that works on desktop and mobile (slide-out sidebar on phones).

## Tech stack

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — dev server + bundler
- [Tailwind CSS](https://tailwindcss.com/) v4 (via `@tailwindcss/vite`)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) — local persistence

## Setup

Prerequisites: [Node.js](https://nodejs.org/) 18+ and npm (or yarn/pnpm).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app will open at `http://localhost:5173` (or another port Vite picks).

### Build for production

```bash
npm run build
```

The compiled site lands in `dist/`. Serve it with any static host, e.g.:

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## How to use it

1. **Open the app** — you land on the Home screen.
2. **Import music** — click **Import Media** in the sidebar and choose
   *Open Music Folder* or *Open Music File*. Songs are added to an *Imported*
   playlist automatically.
3. **Create a playlist** — click **Create Playlist**, type a name, and press Enter.
4. **Play a song** — double-click a track (or click the play button that appears
   on hover). The player bar at the bottom shows the current track.
5. **Like a song** — click the heart next to the current track in the player bar,
   or the heart icon on a playlist row.
6. **Search** — type in the search box to filter playlists and songs.
7. **Recently Played** — the bottom of the sidebar lists your last 10 tracks.
8. **Missing songs** — if a track can't be found after a refresh, a yellow badge
   appears in the header. Click it to reconnect the folder or remove the songs.

## Notes

- BroomPlayer runs entirely in the browser. No account, no cloud, no tracking.
- On Firefox / Safari, folder imports keep a copy of each song in IndexedDB so
  they still play after a refresh. On Chromium, the folder handle is kept alive.
- Song files are never modified or uploaded.

