import { useState, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import FilePicker from './components/FilePicker';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { usePlaylists } from './hooks/usePlaylists';
import { PlaylistItem } from './types';

function App() {
  const {
    playlists,
    recentlyPlayed,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addItemsToPlaylist,
    toggleLike,
    addToRecentlyPlayed,
  } = usePlaylists();

  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    isLoading,
    loadSong,
    togglePlayPause,
    seek,
    setVolume,
  } = useAudioPlayer();

  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const currentPlaylist = playlists.find(p => p.id === currentPlaylistId);
  const songs = currentPlaylist?.items || [];
  const currentIndex = currentSong ? songs.findIndex(s => s.id === currentSong.id) : -1;

  const handleSelectPlaylist = (id: string | null) => {
    setCurrentPlaylistId(id);
    setShowMobileSidebar(false);
  };

  const handleCreatePlaylist = () => {
    const name = prompt('Enter playlist name:');
    if (name) {
      createPlaylist(name);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    if (!currentPlaylistId) {
      alert('Please select a playlist first');
      return;
    }

    const items: PlaylistItem[] = files.map(file => {
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
        liked: false,
      };
    });

    addItemsToPlaylist(currentPlaylistId, items);
    
    if (items.length > 0 && !currentSong) {
      loadSong(items[0]);
    }
  };

  const handlePlaySong = (song: PlaylistItem) => {
    loadSong(song);
    addToRecentlyPlayed(song);
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      handlePlaySong(nextSong);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevSong = songs[currentIndex - 1];
      handlePlaySong(prevSong);
    } else if (currentSong && progress > 3) {
      seek(0);
    }
  };

  const handleToggleLike = () => {
    if (currentSong) {
      toggleLike(currentSong.id);
    }
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
          />
        </div>

        <div ref={mainRef} className="flex-1 flex flex-col overflow-hidden">
          <div className="h-14 bg-spotify-dark flex items-center px-4 gap-4 shadow-lg">
            <div className="flex-1" />
            <FilePicker onFilesSelected={handleFilesSelected} />
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
                    <h1 className="text-6xl font-bold mb-6">{currentPlaylist.name}</h1>
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