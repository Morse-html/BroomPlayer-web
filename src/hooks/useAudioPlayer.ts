import { useState, useRef, useEffect, useCallback } from 'react';
import type { PlaylistItem } from '../types';

const isBlobUrl = (url?: string) => !!url && url.startsWith('blob:');

export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<PlaylistItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);

  const createAudioElement = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = 0.7;
      audio.addEventListener('timeupdate', () => {
        setProgress(audio.currentTime || 0);
      });
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration || 0);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audio.addEventListener('canplay', () => {
        setIsLoading(false);
      });
      audio.addEventListener('error', () => {
        // Avoid uncaught NotSupportedError errors when a source disappears.
        setIsLoading(false);
        setIsPlaying(false);
        if (audio.error) {
          console.warn('Audio could not be played:', audio.error.message);
        }
      });
      audioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    createAudioElement();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (isBlobUrl(audioRef.current.src)) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current.src = '';
      }
    };
  }, [createAudioElement]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const loadSong = useCallback((song: PlaylistItem) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Restored songs carry a live File; always prefer it over a possibly stale URL.
    let src: string | null = null;
    if (song.file instanceof File) {
      src = URL.createObjectURL(song.file);
    } else if (song.url && !isBlobUrl(song.url)) {
      src = song.url;
    }

    if (!src) {
      setCurrentSong(song);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentSong(song);

    if (isBlobUrl(audio.src)) {
      URL.revokeObjectURL(audio.src);
    }
    audio.src = src;
    audio.load();
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn('Playback was blocked or failed:', err);
          setIsPlaying(false);
        });
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

  const setVolumeLevel = useCallback((vol: number) => {
    setVolume(Math.max(0, Math.min(1, vol)));
  }, []);

  return {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    isLoading,
    loadSong,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume: setVolumeLevel,
  };
};
