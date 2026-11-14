import { get, set, del } from 'idb-keyval';
import type { PlaylistItem } from '../types';

const BLOB_KEY_PREFIX = 'broomplayer-song-';

/** True when the file name/type looks like playable audio. */
export const isAudioFile = (file: File | string, type = '') => {
  const name = typeof file === 'string' ? file : file.name;
  const mime = typeof file === 'string' ? type : file.type;
  return mime.startsWith('audio/') || /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(name);
};

export interface AudioEntry {
  file: File;
  relativePath: string;
}

/**
 * True when the browser exposes the File System Access API
 * (Chromium-based browsers). Firefox and Safari do not, and fall back to
 * a hidden <input type="file" webkitdirectory> picker instead.
 */
export const supportsDirectoryPicker = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/**
 * Turn a FileList coming from a folder <input webkitdirectory> into audio
 * entries. Falls back to the bare file name when the browser does not expose
 * webkitRelativePath.
 */
export const collectAudioFromFiles = (
  files: FileList | File[],
): AudioEntry[] => {
  const entries: AudioEntry[] = [];
  Array.from(files).forEach(file => {
    if (!isAudioFile(file)) return;
    const relativePath = file.webkitRelativePath || file.name;
    entries.push({ file, relativePath });
  });
  return entries;
};

/** Resolve the file name a song was imported with (new items store it, old ones use the id). */
export const getItemFileName = (item: PlaylistItem) =>
  item.fileName ?? item.relativePath?.split('/').pop() ?? fileNameFromId(item.id);

/** Recursively collect every audio file in a directory handle, keeping relative paths. */
export const scanFolderForAudio = async (
  dirHandle: any,
  prefix = '',
): Promise<AudioEntry[]> => {
  const entries: AudioEntry[] = [];
  for await (const entry of dirHandle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      const file: File = await entry.getFile();
      if (isAudioFile(file)) entries.push({ file, relativePath: path });
    } else if (entry.kind === 'directory') {
      entries.push(...(await scanFolderForAudio(entry, path)));
    }
  }
  return entries;
};

export interface DirectoryIndex {
  byPath: Map<string, any>;
  byName: Map<string, any[]>;
}

/** Index a directory handle by relative path and by bare file name. */
export const buildDirectoryIndex = async (dirHandle: any): Promise<DirectoryIndex> => {
  const byPath = new Map<string, any>();
  const byName = new Map<string, any[]>();

  const walk = async (handle: any, prefix: string) => {
    for await (const entry of handle.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        byPath.set(path, entry);
        const list = byName.get(entry.name) ?? [];
        list.push(entry);
        byName.set(entry.name, list);
      } else if (entry.kind === 'directory') {
        await walk(entry, path);
      }
    }
  };

  await walk(dirHandle, '');
  return { byPath, byName };
};

/** Old items did not store a file name; recover it from the id ("name.mp3-<time>-<rand>"). */
const fileNameFromId = (id: string) => id.replace(/-\d{10,}-.*$/, '');

/**
 * Find the file for a song inside an indexed directory.
 * Tries the stored relative path first, then falls back to the file name.
 */
export const findFileForItem = async (
  index: DirectoryIndex,
  item: PlaylistItem,
): Promise<File | null> => {
  if (item.relativePath) {
    const exact = index.byPath.get(item.relativePath);
    if (exact) {
      try {
        return await exact.getFile();
      } catch {
        // fall through to name lookup
      }
    }
  }

  const name = item.fileName ?? item.relativePath?.split('/').pop() ?? fileNameFromId(item.id);
  if (name) {
    const matches = index.byName.get(name);
    if (matches && matches.length > 0) {
      try {
        return await matches[0].getFile();
      } catch {
        // fall through
      }
    }
  }

  return null;
};

/** Songs imported through the plain file picker have no folder path, so keep a copy in IndexedDB. */
export const storeSongBlob = async (id: string, file: File) => {
  try {
    await set(`${BLOB_KEY_PREFIX}${id}`, file);
  } catch (e) {
    console.error('Could not store song copy', e);
  }
};

export const getSongBlob = async (id: string): Promise<File | null> => {
  try {
    const blob = await get<Blob | File>(`${BLOB_KEY_PREFIX}${id}`);
    if (!blob) return null;
    if (blob instanceof File) return blob;
    return new File([blob], 'song', { type: blob.type });
  } catch (e) {
    console.error('Could not read stored song copy', e);
    return null;
  }
};

export const deleteSongBlob = async (id: string) => {
  try {
    await del(`${BLOB_KEY_PREFIX}${id}`);
  } catch {
    // ignore
  }
};

/** A song can be played right now if it has a live File or a non-stale URL. */
export const hasPlayableSource = (item: PlaylistItem) =>
  item.file instanceof File || (!!item.url && !item.url.startsWith('blob:'));

/** Blob URLs die when the page reloads, so never let one be reused. */
export const isStaleUrl = (url?: string) => !!url && url.startsWith('blob:');
