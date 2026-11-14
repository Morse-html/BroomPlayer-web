import { useState } from 'react';

interface MusicPlayerProps {
  currentSong: any;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleLike: () => void;
  liked: boolean;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MusicPlayer = ({
  currentSong,
  isPlaying,
  progress,
  duration,
  volume,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleLike,
  liked,
}: MusicPlayerProps) => {
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume || 0.7);

  const isMuted = volume === 0;

  const handleMuteToggle = () => {
    if (isMuted) {
      onVolumeChange(lastVolume > 0 ? lastVolume : 0.7);
    } else {
      setLastVolume(volume);
      onVolumeChange(0);
    }
  };

  const handleVolumeSlider = (value: number) => {
    if (value > 0) setLastVolume(value);
    onVolumeChange(value);
  };

  if (!currentSong) {
    return (
      <div className="h-20 bg-black border-t border-gray-800 flex items-center justify-center px-4">
        <p className="text-spotify-lightGray text-sm">No song selected</p>
      </div>
    );
  }

  return (
    <div className="h-20 bg-black border-t border-gray-800 flex items-center justify-between px-4">
      {/* Left - Song Info */}
      <div className="flex items-center gap-3 w-1/4 min-w-0">
        <img
          src={currentSong.artwork || '/placeholder.svg'}
          alt={currentSong.title}
          className="w-14 h-14 rounded object-cover"
        />
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate hover:underline cursor-pointer">
            {currentSong.title}
          </p>
          <p className="text-spotify-lightGray text-xs truncate hover:underline cursor-pointer">
            {currentSong.artist}
          </p>
        </div>
        <button
          onClick={onToggleLike}
          className="ml-2 text-spotify-lightGray hover:text-spotify-green transition-colors"
        >
          <svg className={`w-4 h-4 ${liked ? 'fill-spotify-green text-spotify-green' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Center - Controls */}
      <div className="flex flex-col items-center gap-2 w-2/4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsShuffled(!isShuffled)}
            className={`text-spotify-lightGray hover:text-white transition-colors ${isShuffled ? 'text-spotify-green' : ''}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.37 11l-4.15 4.18v-4.18h-4l4.15-4.18v4.18h4zm3.15-4.15l-4.3 4.32 4.3 4.3-1.42 1.43-4.3-4.3-4.3 4.3-1.42-1.43 4.3-4.3-4.3-4.32 1.42-1.43 4.3 4.3 4.3-4.3 1.42 1.43zm-10.52 0l-4.3 4.32 4.3 4.3-1.42 1.43-4.3-4.3-4.3 4.3-1.42-1.43 4.3-4.3-4.3-4.32 1.42-1.43 4.3 4.3 4.3-4.3 1.42 1.43z"/>
            </svg>
          </button>
          <button
            onClick={onPrevious}
            className="text-white hover:scale-105 transition-transform"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          <button
            onClick={onPlayPause}
            className="bg-white rounded-full w-8 h-8 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <button
            onClick={onNext}
            className="text-white hover:scale-105 transition-transform"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
          <button
            onClick={() => setIsRepeat(!isRepeat)}
            className={`text-spotify-lightGray hover:text-white transition-colors ${isRepeat ? 'text-spotify-green' : ''}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2 w-full max-w-md">
          <span className="text-xs text-spotify-lightGray w-10 text-right">
            {formatTime(progress)}
          </span>
          <div className="flex-1 group">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={progress}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-spotify-green hover:accent-spotify-green"
              style={{ background: `linear-gradient(to right, white ${(progress / duration) * 100}%, #535353 ${(progress / duration) * 100}%)` }}
            />
          </div>
          <span className="text-xs text-spotify-lightGray w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right - Volume */}
      <div className="flex items-center gap-3 w-1/4 justify-end">
        <button
          onClick={handleMuteToggle}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute' : 'Mute'}
          className="text-spotify-lightGray hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            {isMuted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => handleVolumeSlider(parseFloat(e.target.value))}
          aria-label="Volume"
          title={`Volume ${Math.round(volume * 100)}%`}
          className="w-28 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-spotify-green hover:accent-spotify-green"
          style={{ background: `linear-gradient(to right, white ${volume * 100}%, #535353 ${volume * 100}%)` }}
        />
      </div>
    </div>
  );
};

export default MusicPlayer;