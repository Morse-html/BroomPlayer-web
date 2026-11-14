import { useState, useCallback, useEffect } from 'react';
import { get } from 'idb-keyval';
import type { Playlist, PlaylistItem, RecentlyPlayedItem } from '../types';
import { deleteSongBlob } from '../lib/songLibrary';

const STORAGE_KEY = 'broomplayer_playlists';

/**
 * File objects and blob URLs cannot be saved as JSON. Persist only the data that
 * survives a refresh (including the song's file name / relative path) and rebuild
 * the playable source from disk/IndexedDB after hydrating.
 */
const serializeItem = (item: PlaylistItem) => {
  const { file: _file, url, ...rest } = item;
  return {
    ...rest,
    ...(url && !url.startsWith('blob:') ? { url } : {}),
  };
};

const deserializeItem = (item: any): PlaylistItem => {
  const { file: _file, url, ...rest } = item ?? {};
  return {
    ...rest,
    ...(url && !String(url).startsWith('blob:') ? { url } : {}),
  };
};

export const usePlaylists = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      // Restore last folder handle (used to re-resolve song files after a refresh)
      const storedFolder = await get('recent-folder');
      if (storedFolder) {
        setDirectoryHandle(storedFolder);
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const restoredPlaylists: Playlist[] = (parsed.playlists || []).map((p: any) => ({
            ...p,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            items: (p.items || []).map(deserializeItem),
          }));
          setPlaylists(restoredPlaylists);
          setRecentlyPlayed(parsed.recentlyPlayed || []);
        } catch (e) {
          console.error('Failed to load playlists', e);
        }
      } else {
        const defaultPlaylists: Playlist[] = [
          {
            id: 'liked-songs',
            name: 'Liked Songs',
            items: [],
            createdAt: new Date(),
          },
        ];
        setPlaylists(defaultPlaylists);
      }
      setHydrated(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        playlists: playlists.map(p => ({
          ...p,
          items: p.items.map(serializeItem),
        })),
        recentlyPlayed,
      }),
    );
  }, [playlists, recentlyPlayed, hydrated]);

  // Sync playlists to the JSON file inside the music folder whenever they change
  useEffect(() => {
    if (!directoryHandle || !hydrated) return;
    (async () => {
      try {
        const fileHandle = await directoryHandle.getFileHandle('broomplayer_recent.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify({
          playlists: playlists.map(p => ({ ...p, items: p.items.map(serializeItem) })),
          recentlyPlayed,
        }));
        await writable.close();
      } catch (e) {
        console.error('Could not save playlists JSON', e);
      }
    })();
  }, [playlists, recentlyPlayed, directoryHandle, hydrated]);

  const createPlaylist = useCallback((name: string) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      items: [],
      createdAt: new Date(),
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    return newPlaylist.id;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    if (id === 'liked-songs') return;
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    if (id === 'liked-songs') return;
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, []);

  const addItemsToPlaylist = useCallback((playlistId: string, items: PlaylistItem[]) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId
        ? { ...p, items: [...p.items, ...items] }
        : p
    ));
  }, []);

  const removeItemFromPlaylist = useCallback((playlistId: string, itemId: string) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId
        ? { ...p, items: p.items.filter(item => item.id !== itemId) }
        : p
    ));
  }, []);

  /** Attach freshly resolved playable sources to items (without dropping anything). */
  const updateItemSources = useCallback((updates: Record<string, { file?: File; url?: string }>) => {
    if (Object.keys(updates).length === 0) return;
    setPlaylists(prev => prev.map(p => ({
      ...p,
      items: p.items.map(item => (updates[item.id] ? { ...item, ...updates[item.id] } : item)),
    })));
  }, []);

  /** Permanently remove songs from every playlist / recently played and their stored copies. */
  const removeItems = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setPlaylists(prev => prev.map(p => ({
      ...p,
      items: p.items.filter(item => !idSet.has(item.id)),
    })));
    setRecentlyPlayed(prev => prev.filter(r => !idSet.has(r.id)));
    ids.forEach(id => { void deleteSongBlob(id); });
  }, []);

  const toggleLike = useCallback((itemId: string) => {
    setPlaylists(prev => {
      const source = prev.flatMap(p => p.items).find(item => item.id === itemId);
      if (!source) return prev;

      const newLiked = !source.liked;
      const updatedPlaylists = prev.map(playlist => ({
        ...playlist,
        items: playlist.items.map(item =>
          item.id === itemId ? { ...item, liked: newLiked } : item,
        ),
      }));

      // Update Liked Songs collection
      const likedSongsIndex = updatedPlaylists.findIndex(p => p.id === 'liked-songs');
      if (likedSongsIndex === -1) return updatedPlaylists;

      const likedPlaylists = [...updatedPlaylists];
      const likedPlaylist = { ...likedPlaylists[likedSongsIndex] };
      if (newLiked) {
        // Add to liked songs if not already present
        if (!likedPlaylist.items.some(item => item.id === itemId)) {
          likedPlaylist.items = [...likedPlaylist.items, { ...source, liked: true }];
        }
      } else {
        // Remove from liked songs
        likedPlaylist.items = likedPlaylist.items.filter(item => item.id !== itemId);
      }
      likedPlaylists[likedSongsIndex] = likedPlaylist;
      return likedPlaylists;
    });
  }, []);

  const addToRecentlyPlayed = useCallback((item: PlaylistItem) => {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(r => r.id !== item.id);
      const newItem: RecentlyPlayedItem = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        artwork: item.artwork,
        duration: item.duration,
        playedAt: new Date(),
      };
      return [newItem, ...filtered].slice(0, 50);
    });
  }, []);

  return {
    playlists,
    recentlyPlayed,
    hydrated,
    directoryHandle,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addItemsToPlaylist,
    removeItemFromPlaylist,
    updateItemSources,
    removeItems,
    toggleLike,
    addToRecentlyPlayed,
    setDirectoryHandle,
  };
};
