import { useState, useRef } from 'react';
import { collectAudioFromFiles, supportsDirectoryPicker } from '../lib/songLibrary';
import type { AudioEntry } from '../lib/songLibrary';

interface FilePickerProps {
  onFilesSelected: (files: File[]) => void;
  onFolderSelected: (dirHandle: FileSystemDirectoryHandle) => void;
  /** Fallback used by browsers without the File System Access API (Firefox, Safari). */
  onFolderFilesSelected?: (entries: AudioEntry[]) => void;
}

const FilePicker = ({
  onFilesSelected,
  onFolderSelected,
  onFolderFilesSelected,
}: FilePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const musicFiles: File[] = [];
    Array.from(files).forEach(file => {
      const isAudio = file.type.startsWith('audio/') ||
        /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(file.name);
      if (isAudio) {
        musicFiles.push(file);
      }
    });

    if (musicFiles.length > 0) {
      onFilesSelected(musicFiles);
      setIsOpen(false);
    } else {
      alert('No music files found. Please select audio files (MP3, WAV, FLAC, M4A, OGG, AAC)');
    }
  };

  const handleFolderSelect = async () => {
    // Firefox/Safari: fall back to a hidden <input webkitdirectory>.
    if (!supportsDirectoryPicker()) {
      if (!onFolderFilesSelected) {
        alert('Your browser does not support folder selection.');
        return;
      }
      folderInputRef.current?.click();
      return;
    }

    try {
      // @ts-ignore - File System Access API types
      const dirHandle = await window.showDirectoryPicker();
      onFolderSelected(dirHandle);
      setIsOpen(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User cancelled the picker, this is normal
        return;
      }
      console.error('Error selecting folder', err);
      alert('Could not open folder. Please try again.');
    }
  };

  const handleFolderInputSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const entries = collectAudioFromFiles(files);
    if (entries.length === 0) {
      alert('No music files found in the selected folder. Please make sure it contains audio files (MP3, WAV, FLAC, M4A, OGG, AAC).');
      return;
    }
    onFolderFilesSelected?.(entries);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-spotify-card border border-spotify-border rounded-md text-spotify-lightGray hover:text-white hover:border-spotify-muted text-sm transition-colors"
      >
        Import Media
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-full rounded-md py-1 z-50 bg-spotify-card border border-spotify-border shadow-2xl">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 text-left text-white hover:bg-white/5 text-sm transition-colors rounded-t-md"
            >
              Open Music File
            </button>
            <button
              onClick={handleFolderSelect}
              className="w-full px-4 py-2 text-left text-white hover:bg-white/5 text-sm transition-colors rounded-b-md"
            >
              Open Music Folder
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
        multiple
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Fallback folder picker for browsers without showDirectoryPicker (Firefox, Safari) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          handleFolderInputSelect(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
};

export default FilePicker;