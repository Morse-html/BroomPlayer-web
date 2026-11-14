import { useState, useRef, useEffect, useCallback } from 'react';
import { set } from 'idb-keyval';
import Sidebar from './components/layout/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import MissingSongsDialog from './components/MissingSongsDialog';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { usePlaylists } from './hooks/usePlaylists';
import {
  buildDirectoryIndex,
  collectAudioFromFiles,
  findFileForItem,
  getItemFileName,
  getSongBlob,
  hasPlayableSource,
  scanFolderForAudio,
  storeSongBlob,
  supportsDirectoryPicker,
} from './lib/songLibrary';
import type { AudioEntry } from './lib/songLibrary';
import type { PlaylistItem, RecentlyPlayedItem } from './types';

function App() {
  const {
    playlists,
    recentlyPlayed,
    hydrated,
    directoryHandle,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addItemsToPlaylist,
    toggleLike,
    addToRecentlyPlayed,
    updateItemSources,
    removeItems,
    setDirectoryHandle,
  } = usePlaylists();

  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    loadSong,
    togglePlayPause,
    seek,
    setVolume,
  } = useAudioPlayer();

  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [missingSongIds, setMissingSongIds] = useState<string[]>([]);
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const locateFolderInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredRef = useRef(false);

  const currentPlaylist = playlists.find(p => p.id === currentPlaylistId);
  const songs = currentPlaylist?.items || [];
  const currentIndex = currentSong ? songs.findIndex(s => s.id === currentSong.id) : -1;

  // Songs that exist in a playlist but currently have no usable file source.
  const missingSongs = Array.from(
    new Map(
      playlists
        .flatMap(p => p.items)
        .filter(item => missingSongIds.includes(item.id))
        .map(item => [item.id, item]),
    ).values(),
  );

  const handleSelectPlaylist = (id: string | null) => {
    setCurrentPlaylistId(id);
    setShowMobileSidebar(false);
  };

  // Sidebar now passes the typed name directly — no prompt()
  const handleCreatePlaylist = (name: string) => {
    createPlaylist(name);
  };

  /** Check read permission on a stored folder handle without prompting. */
  const hasFolderReadAccess = useCallback(async (handle: any): Promise<boolean> => {
    if (!handle?.queryPermission) return false;
    try {
      return (await handle.queryPermission({ mode: 'read' })) === 'granted';
    } catch {
      return false;
    }
  }, []);

  /**
   * Rebuild playable sources for items that lost theirs after a refresh.
   * First tries the copy kept in IndexedDB, then falls back to the music folder.
   */
  const resolveSources = useCallback(async (
    items: PlaylistItem[],
    dirHandle: any | null,
  ): Promise<{ updates: Record<string, { file: File }>; missingIds: string[] }> => {
    const updates: Record<string, { file: File }> = {};
    let remaining: PlaylistItem[] = [];

    for (const item of items) {
      if (hasPlayableSource(item)) continue;
      const stored = await getSongBlob(item.id);
      if (stored) {
        updates[item.id] = { file: stored };
      } else {
        remaining.push(item);
      }
    }

    if (dirHandle && remaining.length > 0) {
      try {
        const index = await buildDirectoryIndex(dirHandle);
        const nextRemaining: PlaylistItem[] = [];
        for (const item of remaining) {
          const file = await findFileForItem(index, item);
          if (file) {
            updates[item.id] = { file };
          } else {
            nextRemaining.push(item);
          }
        }
        remaining = nextRemaining;
      } catch (e) {
        console.error('Could not scan the music folder', e);
      }
    }

    return { updates, missingIds: remaining.map(item => item.id) };
  }, []);

  const playItem = useCallback((item: PlaylistItem) => {
    loadSong(item);
    addToRecentlyPlayed(item);
  }, [loadSong, addToRecentlyPlayed]);

  /** Make sure an item has a live source before trying to play it. */
  const ensurePlayable = useCallback(async (item: PlaylistItem): Promise<PlaylistItem | null> => {
    if (hasPlayableSource(item)) return item;

    const stored = await getSongBlob(item.id);
    if (stored) {
      updateItemSources({ [item.id]: { file: stored } });
      return { ...item, file: stored };
    }

    if (directoryHandle && (await hasFolderReadAccess(directoryHandle))) {
      try {
        const index = await buildDirectoryIndex(directoryHandle);
        const file = await findFileForItem(index, item);
        if (file) {
          updateItemSources({ [item.id]: { file } });
          return { ...item, file };
        }
      } catch (e) {
        console.error('Could not look up the song in the music folder', e);
      }
    }

    return null;
  }, [directoryHandle, hasFolderReadAccess, updateItemSources]);

  const handlePlaySong = async (song: PlaylistItem) => {
    const playable = await ensurePlayable(song);
    if (playable) {
      setMissingSongIds(prev => prev.filter(id => id !== song.id));
      playItem(playable);
    } else {
      setMissingSongIds(prev => (prev.includes(song.id) ? prev : [...prev, song.id]));
      setPendingPlayId(song.id);
      setShowMissingDialog(true);
    }
  };

  const addEntriesToPlaylist = async (
    entries: { file: File; relativePath?: string }[],
    persistCopies: boolean,
    targetId?: string | null,
  ) => {
    if (entries.length === 0) return;
    const finalId = targetId || currentPlaylistId;
    if (!finalId) {
      alert('Please select a playlist first');
      return;
    }

    const items: PlaylistItem[] = entries.map(({ file, relativePath }) => {
      const url = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '');
      const parts = name.split(' - ');
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        title: parts[1] || name,
        artist: parts[0] || 'Unknown Artist',
        duration: 0,
        file,
        url,
        fileName: file.name,
        ...(relativePath ? { relativePath } : {}),
        liked: false,
      };
    });

    addItemsToPlaylist(finalId, items);

    if (items.length > 0 && !currentSong) {
      loadSong(items[0]);
    }

    if (persistCopies) {
      // Plain file-picker imports have no folder to re-read after a refresh,
      // so keep a copy the browser can restore.
      items.forEach(item => {
        if (item.file) void storeSongBlob(item.id, item.file);
      });
    }
  };

  const ensureTargetPlaylistId = () => {
    let targetPlaylistId = currentPlaylistId;
    if (!targetPlaylistId) {
      const existingImported = playlists.find(p => p.name === 'Imported');
      if (existingImported) {
        targetPlaylistId = existingImported.id;
      } else {
        targetPlaylistId = createPlaylist('Imported');
      }
      setCurrentPlaylistId(targetPlaylistId);
    }
    return targetPlaylistId;
  };

  const handleFilesSelected = (files: File[]) => {
    const targetId = ensureTargetPlaylistId();
    void addEntriesToPlaylist(
      files.map(file => ({ file, relativePath: file.webkitRelativePath || undefined })),
      true,
      targetId
    );
  };

  /**
   * Browser fallback (Firefox / Safari): the selected folder is delivered as a
   * list of Files instead of a live directory handle. Keep a copy of each song in
   * IndexedDB so they can still be restored after a refresh.
   */
  const handleFolderFilesSelected = (entries: AudioEntry[]) => {
    if (entries.length === 0) return;
    const targetId = ensureTargetPlaylistId();
    void addEntriesToPlaylist(
      entries.map(({ file, relativePath }) => ({ file, relativePath })),
      true,
      targetId,
    );
  };

  const handleFolderSelected = async (dirHandle: FileSystemDirectoryHandle) => {
    setDirectoryHandle(dirHandle);
    await set('recent-folder', dirHandle);

    try {
      const fileHandle = await dirHandle.getFileHandle('broomplayer_recent.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify({ lastOpened: new Date(), folderName: dirHandle.name }));
      await writable.close();
    } catch (e) {
      console.error('Could not create JSON file', e);
    }

    try {
      console.log('Scanning folder for audio...', dirHandle.name);
      const entries = await scanFolderForAudio(dirHandle);
      console.log(`Found ${entries.length} audio files`);
      
      if (entries.length > 0) {
        const targetId = ensureTargetPlaylistId();
        console.log('Adding entries to playlist:', targetId);
        await addEntriesToPlaylist(entries, false, targetId);
      } else {
        alert('No music files found in the selected folder. Please make sure the folder contains audio files (MP3, WAV, etc.).');
      }
    } catch (e) {
      console.error('Could not scan the music folder', e);
      alert('Error scanning folder. Make sure you have given permission to read the folder.');
    }
  };

  // Sidebar's "Recently Played" now calls this with a RecentlyPlayedItem.
  // Look the full PlaylistItem back up in any playlist so playback works.
  const handlePlayRecent = (recent: RecentlyPlayedItem) => {
    for (const p of playlists) {
      const found = p.items.find(i => i.id === recent.id);
      if (found) {
        void handlePlaySong(found);
        return;
      }
    }
    // Fallback: the track no longer exists in any playlist (was deleted).
    // Play a minimal PlaylistItem reconstructed from the recent entry.
    if (recent.duration > 0) {
      void handlePlaySong({
        id: recent.id,
        title: recent.title,
        artist: recent.artist,
        artwork: recent.artwork,
        duration: recent.duration,
        liked: false,
      });
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      void handlePlaySong(nextSong);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevSong = songs[currentIndex - 1];
      void handlePlaySong(prevSong);
    } else if (currentSong && progress > 3) {
      seek(0);
    }
  };

  const handleToggleLike = () => {
    if (currentSong) {
      toggleLike(currentSong.id);
    }
  };

  /** After a refresh, verify every restored song still has a playable source. */
  useEffect(() => {
    if (!hydrated || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const restore = async () => {
      const uniqueItems = Array.from(
        new Map(playlists.flatMap(p => p.items).map(item => [item.id, item])).values(),
      );
      const needsRestore = uniqueItems.filter(item => !hasPlayableSource(item));
      if (needsRestore.length === 0) return;

      let handle = directoryHandle;
      if (handle && !(await hasFolderReadAccess(handle))) {
        handle = null;
      }

      const { updates, missingIds } = await resolveSources(needsRestore, handle);
      updateItemSources(updates);

      if (missingIds.length > 0) {
        setMissingSongIds(missingIds);
        setShowMissingDialog(true);
      }
    };

    void restore();
  }, [hydrated, playlists, directoryHandle, hasFolderReadAccess, resolveSources, updateItemSources]);

  // Folder name shown in the header (derived from the active directory handle).
  const songDirectory: string | null = directoryHandle?.name ?? null;

  /** Resolve every currently-missing song against a directory the user granted access to. */
  const applyResolvedFolder = useCallback(async (dirHandle: any): Promise<void> => {
    const granted = (await dirHandle.requestPermission?.({ mode: 'read' })) ?? 'denied';
    if (granted !== 'granted') {
      setLocateError('Read permission for the folder was not granted.');
      return;
    }

    setDirectoryHandle(dirHandle);
    await set('recent-folder', dirHandle);

    const targets = Array.from(
      new Map(
        playlists
          .flatMap(p => p.items)
          .filter(item => missingSongIds.includes(item.id) && !hasPlayableSource(item))
          .map(item => [item.id, item]),
      ).values(),
    );

    const { updates, missingIds } = await resolveSources(targets, dirHandle);
    updateItemSources(updates);
    setMissingSongIds(missingIds);
    setShowMissingDialog(missingIds.length > 0);

    // If the user tried to play a song before reconnecting, start it now.
    if (pendingPlayId && updates[pendingPlayId]) {
      const target = targets.find(item => item.id === pendingPlayId);
      if (target) {
        setMissingSongIds(prev => prev.filter(id => id !== pendingPlayId));
        playItem({ ...target, file: updates[pendingPlayId].file });
        setPendingPlayId(null);
      }
    }

    if (missingIds.length > 0) {
      setLocateError('Some songs were not found in the selected folder.');
    } else {
      setLocateError(null);
    }
  }, [missingSongIds, pendingPlayId, playlists, playItem, resolveSources, setDirectoryHandle, updateItemSources]);

  const handleLocateFolder = async () => {
    if (!supportsDirectoryPicker()) {
      // Firefox / Safari: no File System Access API, use <input webkitdirectory>.
      locateFolderInputRef.current?.click();
      return;
    }

    setIsLocating(true);
    setLocateError(null);
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      await applyResolvedFolder(dirHandle);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Could not open the folder', err);
      setLocateError('Could not open the folder. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  /** Browser fallback: resolve unavailable songs from folder files (Firefox / Safari). */
  const applyResolvedFiles = useCallback(async (files: File[]): Promise<void> => {
    const byPath = new Map<string, File>();
    const byName = new Map<string, File[]>();

    for (const file of files) {
      const fullPath = file.webkitRelativePath || file.name;
      // webkitRelativePath includes the chosen folder name as first segment.
      const relative = fullPath.includes('/') ? fullPath.slice(fullPath.indexOf('/') + 1) : fullPath;
      byPath.set(fullPath, file);
      byPath.set(relative, file);
      const list = byName.get(file.name) ?? [];
      list.push(file);
      byName.set(file.name, list);
    }

    const targets = Array.from(
      new Map(
        playlists
          .flatMap(p => p.items)
          .filter(item => missingSongIds.includes(item.id) && !hasPlayableSource(item))
          .map(item => [item.id, item]),
      ).values(),
    );

    const updates: Record<string, { file: File }> = {};
    const missingIds: string[] = [];

    for (const item of targets) {
      let file: File | undefined;
      if (item.relativePath) {
        file = byPath.get(item.relativePath);
      }
      if (!file) {
        const matches = byName.get(getItemFileName(item));
        file = matches?.[0];
      }

      if (file) {
        updates[item.id] = { file };
        // Firefox cannot keep a folder handle, so persist a copy for next time.
        void storeSongBlob(item.id, file);
      } else {
        missingIds.push(item.id);
      }
    }

    updateItemSources(updates);
    setMissingSongIds(missingIds);
    setShowMissingDialog(missingIds.length > 0);

    if (pendingPlayId && updates[pendingPlayId]) {
      const target = targets.find(item => item.id === pendingPlayId);
      if (target) {
        setMissingSongIds(prev => prev.filter(id => id !== pendingPlayId));
        playItem({ ...target, file: updates[pendingPlayId].file });
        setPendingPlayId(null);
      }
    }

    setLocateError(
      missingIds.length > 0
        ? 'Some songs were not found in the selected folder.'
        : null,
    );
  }, [missingSongIds, pendingPlayId, playlists, playItem, updateItemSources]);

  const handleLocateFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const entries = collectAudioFromFiles(files);
    if (entries.length === 0) {
      setLocateError('No audio files found in the selected folder.');
      return;
    }

    setIsLocating(true);
    setLocateError(null);
    try {
      await applyResolvedFiles(entries.map(entry => entry.file));
    } catch (err) {
      console.error('Could not resolve the folder files', err);
      setLocateError('Could not read the selected folder. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleReconnectFolder = async () => {
    if (!directoryHandle) return;

    setIsLocating(true);
    setLocateError(null);
    try {
      await applyResolvedFolder(directoryHandle);
    } catch (err) {
      console.error('Could not reconnect the folder', err);
      setLocateError('Could not reconnect the folder. Please locate it manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleRemoveMissing = () => {
    removeItems(missingSongs.map(song => song.id));
    setMissingSongIds([]);
    setPendingPlayId(null);
    setShowMissingDialog(false);
    setLocateError(null);
  };

  const handleDismissMissing = () => {
    setShowMissingDialog(false);
    setPendingPlayId(null);
    setLocateError(null);
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-spotify-dark p-2 rounded-md"
        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex flex-1 overflow-hidden">
        <div className={`fixed lg:relative z-40 h-full ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform duration-300`}>
          <Sidebar
            playlists={playlists}
            currentPlaylistId={currentPlaylistId}
            onSelectPlaylist={handleSelectPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={deletePlaylist}
            onRenamePlaylist={renamePlaylist}
            recentlyPlayed={recentlyPlayed}
            onPlaySong={handlePlayRecent}
            onImportFiles={handleFilesSelected}
            onImportFolder={handleFolderSelected}
            onImportFolderFiles={handleFolderFilesSelected}
          />
        </div>

        <div ref={mainRef} className="flex-1 flex flex-col overflow-hidden">
          <div className="h-14 bg-spotify-dark flex items-center px-4 gap-4 shadow-lg">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {songDirectory && (
                <span className="text-xs text-spotify-lightGray truncate" title={songDirectory}>
                  Folder: {songDirectory}
                </span>
              )}
              {missingSongs.length > 0 && (
                <button
                  onClick={() => setShowMissingDialog(true)}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {missingSongs.length} unavailable
                </button>
              )}
            </div>
           
          </div>

          <div className="flex-1 overflow-y-auto bg-linear-to-b from-spotify-gray to-black">
            {!currentPlaylistId ? (
              <div className="p-8">
                <h1 className="text-3xl font-bold mb-6">Welcome to BroomPlayer</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-spotify-dark rounded-lg p-6 hover:bg-gray-800 transition-colors">
                    <h3 className="font-semibold mb-2">Create a Playlist</h3>
                    <p className="text-sm text-spotify-lightGray">Add your favorite music files</p>
                  </div>
                  <div className="bg-spotify-dark rounded-lg p-6 hover:bg-gray-800 transition-colors">
                    <h3 className="font-semibold mb-2">Import Music</h3>
                    <p className="text-sm text-spotify-lightGray">Use Files menu to import songs</p>
                  </div>
                  <div className="bg-spotify-dark rounded-lg p-6 hover:bg-gray-800 transition-colors">
                    <h3 className="font-semibold mb-2">Recently Played</h3>
                    <p className="text-sm text-spotify-lightGray">Quick access to your favorites</p>
                  </div>
                </div>
              </div>
            ) : songs.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🎵</div>
                <h2 className="text-2xl font-bold mb-2">Your playlist is empty</h2>
                <p className="text-spotify-lightGray mb-4">Import some music files to get started</p>
                <p className="text-sm text-spotify-lightGray">Use the Files menu in the top right</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-end gap-6 mb-8">
                  <div className="w-52 h-52 bg-linear-to-br from-purple-600 to-blue-600 rounded-md flex items-center justify-center shadow-2xl">
                    <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">PLAYLIST</p>
                    <h1 className="text-6xl font-bold mb-6">{currentPlaylist!.name}</h1>
                    <p className="text-sm text-spotify-lightGray">
                      {songs.length} {songs.length === 1 ? 'song' : 'songs'}, {Math.floor(songs.length * 3.5)} min
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <button
                    onClick={() => currentSong ? togglePlayPause() : handlePlaySong(songs[0])}
                    className="bg-spotify-green rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    {currentSong && isPlaying ? (
                      <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                  <button className="text-spotify-lightGray hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                <div className="bg-spotify-dark/50 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-gray-800 text-sm text-spotify-lightGray">
                    <div className="w-8 text-center">#</div>
                    <div>Title</div>
                    <div>Album</div>
                    <div className="text-right pr-4">Date added</div>
                    <div className="w-12" />
                    <div className="w-12 text-center">⏱</div>
                  </div>
                  {songs.map((song, index) => (
                    <div
                      key={song.id}
                      onDoubleClick={() => handlePlaySong(song)}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2 hover:bg-white/10 rounded-md group cursor-pointer"
                    >
                      <div className="w-8 text-center flex items-center justify-center">
                        <span className="text-spotify-lightGray group-hover:hidden">
                          {index + 1}
                        </span>
                        <button
                          onClick={() => handlePlaySong(song)}
                          className="hidden group-hover:block text-white"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate ${currentSong?.id === song.id ? 'text-spotify-green' : 'text-white'}`}>
                            {song.title}
                            {missingSongIds.includes(song.id) && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
                                Unavailable
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-spotify-lightGray truncate">{song.artist}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-spotify-lightGray text-sm">
                        {song.album || '-'}
                      </div>
                      <div className="flex items-center text-spotify-lightGray text-sm">
                        Recently added
                      </div>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => toggleLike(song.id)}
                          className={`hidden group-hover:block ${song.liked ? 'text-spotify-green' : 'text-spotify-lightGray hover:text-white'}`}
                        >
                          <svg className="w-4 h-4" fill={song.liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-end text-spotify-lightGray text-sm">
                        3:45
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MusicPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        onPlayPause={togglePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSeek={seek}
        onVolumeChange={setVolume}
        onToggleLike={handleToggleLike}
        liked={currentSong?.liked || false}
      />

      {showMissingDialog && missingSongs.length > 0 && (
        <MissingSongsDialog
          songs={missingSongs}
          canReconnect={!!directoryHandle}
          busy={isLocating}
          error={locateError}
          onLocateFolder={() => void handleLocateFolder()}
          onReconnect={() => void handleReconnectFolder()}
          onRemove={handleRemoveMissing}
          onDismiss={handleDismissMissing}
        />
      )}

      {/* Fallback folder picker for Firefox/Safari when relocating missing songs */}
      <input
        ref={locateFolderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          void handleLocateFilesSelected(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
    </div>
  );
}

export default App;