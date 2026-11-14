import { useState, useRef, useEffect, useMemo } from 'react';
import FilePicker from '../FilePicker';
import type { AudioEntry } from '../../lib/songLibrary';
import type { Playlist, PlaylistItem, RecentlyPlayedItem } from '../../types';
import PlaylistContextMenu from './PlaylistContextMenu';

interface SidebarProps {
  playlists: Playlist[];
  currentPlaylistId: string | null;
  onSelectPlaylist: (id: string | null) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  recentlyPlayed: RecentlyPlayedItem[];
  onPlaySong?: (song: RecentlyPlayedItem) => void;
  onImportFiles?: (files: File[]) => void;
  onImportFolder?: (dirHandle: FileSystemDirectoryHandle) => void;
  /** Browser fallback: folder chosen through <input webkitdirectory>. */
  onImportFolderFiles?: (entries: AudioEntry[]) => void;
}

const Sidebar = ({
  playlists,
  currentPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  recentlyPlayed,
  onPlaySong,
  onImportFiles,
  onImportFolder,
  onImportFolderFiles,
}: SidebarProps) => {
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlistId: string } | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('broomplayer_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('broomplayer_recent_searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const allSongs = useMemo(() => {
    return playlists.flatMap(p => p.items.map(song => ({
      song,
      playlistId: p.id,
      playlistName: p.name,
    })));
  }, [playlists]);

  const normalized = searchQuery.trim().toLowerCase();
  
  const filteredPlaylists = useMemo(() => {
    if (!normalized) return [];
    return playlists.filter(p => p.name.toLowerCase().includes(normalized));
  }, [normalized, playlists]);

  const filteredSongs = useMemo(() => {
    if (!normalized) return [];
    return allSongs.filter(({ song }) => 
      song.title.toLowerCase().includes(normalized) ||
      song.artist.toLowerCase().includes(normalized)
    ).slice(0, 20);
  }, [normalized, allSongs]);

  const addRecentSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecentSearches(prev => [q, ...prev.filter(s => s !== q)].slice(0, 5));
  };

  const removeRecentSearch = (query: string) => {
    setRecentSearches(prev => prev.filter(q => q !== query));
  };

  const handleSelectPlaylist = (id: string) => {
    onSelectPlaylist(id);
    addRecentSearch(searchQuery);
    setShowSearchMenu(false);
    setSearchQuery('');
  };

  const handleSelectSong = (song: PlaylistItem) => {
    const recent: RecentlyPlayedItem = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
      duration: song.duration,
      playedAt: new Date(),
    };
    onPlaySong?.(recent);
    addRecentSearch(searchQuery);
    setShowSearchMenu(false);
    setSearchQuery('');
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (name) {
      onCreatePlaylist(name);
      setShowCreatePlaylist(false);
      setNewPlaylistName('');
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlaylistId && editName.trim()) {
      onRenamePlaylist(editingPlaylistId, editName.trim());
      setEditingPlaylistId(null);
      setEditName('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, playlistId });
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
      setShowSearchMenu(false);
    }
  };

  useEffect(() => {
    // @ts-ignore
    document.addEventListener('mousedown', handleClickOutside);
    // @ts-ignore
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  return (
    <div
      ref={sidebarRef}
      className="w-64 bg-spotify-black flex flex-col h-screen border-r border-gray-800 overflow-y-auto"
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3C6.477 3 2 7.477 2 13c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm5.521 17.34c-.142.724-.786 1.185-1.389.973-2.226-.753-4.167-2.173-5.632-4.123-.137-.182-.18-.4-.117-.61.064-.21.267-.347.485-.313 1.465.214 3.171.854 4.564 1.997.132.108.21.283.21.466v.59zM12 5.36c2.317 0 4.308 1.459 5.18 3.518-.076.396-.107.793-.095 1.184.014.464.373.825.778.944C17.672 12.607 17 14.309 17 16.103c0 3.04-2.46 5.5-5.5 5.5S4.5 19.143 4.5 16.103c0-1.794.672-3.496 1.737-4.707.406-.118.764-.48.778-.944.013-.39-.019-.788-.095-1.184C7.692 6.819 9.683 5.36 12 5.36zm0 2.085c-1.575 0-2.957.785-3.794 1.979-.032.044-.052.09-.052.138v.565c0 .31.18.58.448.696C9.755 12.446 11.12 14 13 14s3.245-1.554 4.194-3.738c.27-.116.45-.386.45-.697v-.564c0-.048-.02-.094-.052-.138C14.957 8.23 13.575 7.445 12 7.445z"/>
          </svg>
        </div>
        <span className="font-bold text-xl text-white">BroomPlayer</span>
      </div>

      {/* Home */}
      <nav className="px-4 space-y-1">
        <button
          onClick={() => onSelectPlaylist(null)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
            currentPlaylistId === null
              ? 'bg-gray-800 text-white'
              : 'text-spotify-lightGray hover:text-white hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span className="font-medium">Home</span>
        </button>
      </nav>

      {/* Search, Import, Liked Songs */}
      <div className="px-4 py-4 space-y-3" ref={searchRef}>
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search songs, playlists..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-9 pr-9 text-white placeholder-gray-500 focus:outline-none focus:border-spotify-green"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchMenu(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRecentSearch(searchQuery);
            }}
            autoComplete="off"
          />
          <svg className="w-4 h-4 absolute left-3 top-3 text-spotify-lightGray" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-spotify-lightGray hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {showSearchMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-spotify-dark border border-gray-700 rounded-md shadow-2xl z-50 max-h-[70vh] overflow-y-auto">
              {/* Recent Searches */}
              {!normalized && recentSearches.length > 0 && (
                <div className="p-2 border-b border-gray-800">
                  <div className="px-2 py-1 text-[10px] font-bold text-spotify-lightGray uppercase tracking-wider">Recent Searches</div>
                  {recentSearches.map((term) => (
                    <div key={term} className="flex items-center group">
                      <button
                        onClick={() => setSearchQuery(term)}
                        className="flex-1 text-left px-2 py-1.5 text-sm text-white hover:bg-white/10 rounded transition-colors truncate"
                      >
                        {term}
                      </button>
                      <button
                        onClick={() => removeRecentSearch(term)}
                        className="p-1.5 text-spotify-lightGray hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search Results */}
              {normalized && (
                <>
                  {filteredPlaylists.length > 0 && (
                    <div className="p-2 border-b border-gray-800">
                      <div className="px-2 py-1 text-[10px] font-bold text-spotify-lightGray uppercase tracking-wider">Playlists</div>
                      {filteredPlaylists.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPlaylist(p.id)}
                          className="w-full text-left px-2 py-1.5 text-sm text-white hover:bg-white/10 rounded transition-colors truncate"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredSongs.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-[10px] font-bold text-spotify-lightGray uppercase tracking-wider">Songs</div>
                      {filteredSongs.map(({ song }) => (
                        <button
                          key={song.id}
                          onClick={() => handleSelectSong(song)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 transition-colors group"
                        >
                          <div className="text-sm text-white truncate">{song.title}</div>
                          <div className="text-[11px] text-spotify-lightGray truncate group-hover:text-white">{song.artist}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredPlaylists.length === 0 && filteredSongs.length === 0 && (
                    <div className="p-4 text-center text-sm text-spotify-lightGray">
                      No results for "{searchQuery}"
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <FilePicker
          onFilesSelected={onImportFiles || (() => {})}
          onFolderSelected={onImportFolder || (() => {})}
          onFolderFilesSelected={onImportFolderFiles}
        />
        <button
          onClick={() => onSelectPlaylist('liked-songs')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
            currentPlaylistId === 'liked-songs'
              ? 'bg-gray-800 text-white'
              : 'text-spotify-lightGray hover:text-white hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span className="font-medium">Liked Songs</span>
        </button>
      </div>

      {/* Create Playlist */}
      <div className="px-4 py-4">
        {showCreatePlaylist ? (
          <form onSubmit={handleCreatePlaylist} className="space-y-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-spotify-green"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-spotify-green text-black font-semibold py-2 rounded hover:bg-green-400 transition-colors">
                Create
              </button>
              <button type="button" onClick={() => setShowCreatePlaylist(false)} className="flex-1 bg-gray-700 text-white font-semibold py-2 rounded hover:bg-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreatePlaylist(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-spotify-lightGray hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span className="font-medium">Create Playlist</span>
          </button>
        )}
      </div>

      {/* Playlists */}
      <div className="flex-1 px-4 overflow-y-auto">
        <h3 className="text-xs font-semibold text-spotify-lightGray uppercase tracking-wider mb-3 px-2">PLAYLISTS</h3>
        <div className="space-y-1">
          {playlists.filter(p => p.id !== 'liked-songs').map((playlist) => (
            <div key={playlist.id} className="relative">
              <button
                onClick={() => onSelectPlaylist(playlist.id)}
                onContextMenu={(e) => handleContextMenu(e, playlist.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  currentPlaylistId === playlist.id
                    ? 'bg-gray-800 text-white'
                    : 'text-spotify-lightGray hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="w-8 h-8 bg-linear-to-br from-spotify-green to-green-600 rounded flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zm0 4H3v2h12v-2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                  </svg>
                </div>
                <span className="truncate font-medium">{playlist.name}</span>
              </button>
              {contextMenu?.playlistId === playlist.id && (
                <PlaylistContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  playlist={playlist}
                  onRename={() => {
                    setEditingPlaylistId(playlist.id);
                    setEditName(playlist.name);
                    setContextMenu(null);
                  }}
                  onDelete={() => {
                    onDeletePlaylist(playlist.id);
                    setContextMenu(null);
                  }}
                  onClose={() => setContextMenu(null)}
                />
              )}
              {editingPlaylistId === playlist.id && (
                <form onSubmit={handleRenameSubmit} className="px-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-gray-800 border border-spotify-green rounded px-2 py-1 text-white text-sm focus:outline-none"
                    autoFocus
                  />
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-xs font-semibold text-spotify-lightGray uppercase tracking-wider mb-3 px-2">RECENTLY PLAYED</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentlyPlayed.slice(0, 10).map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                onClick={() => onPlaySong?.(item)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-spotify-lightGray hover:text-white hover:bg-gray-800 transition-colors"
              >
                {item.artwork ? (
                  <img src={item.artwork} alt={item.title} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{item.title}</p>
                  <p className="text-xs truncate text-spotify-lightGray">{item.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
