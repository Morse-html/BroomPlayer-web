import type { PlaylistItem } from '../types';

interface MissingSongsDialogProps {
  songs: PlaylistItem[];
  /** The app remembers a music folder that just needs permission again. */
  canReconnect: boolean;
  busy: boolean;
  error?: string | null;
  onLocateFolder: () => void;
  onReconnect: () => void;
  onRemove: () => void;
  onDismiss: () => void;
}

const MissingSongsDialog = ({
  songs,
  canReconnect,
  busy,
  error,
  onLocateFolder,
  onReconnect,
  onRemove,
  onDismiss,
}: MissingSongsDialogProps) => {
  if (songs.length === 0) return null;

  const preview = songs.slice(0, 6);
  const remaining = songs.length - preview.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-lg bg-spotify-dark border border-gray-700 shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {songs.length === 1 ? '1 song is unavailable' : `${songs.length} songs are unavailable`}
            </h2>
            <p className="text-sm text-spotify-lightGray mt-1">
              These songs could not be found after the page was refreshed. Reconnect their
              folder or remove them from your library.
            </p>
          </div>
        </div>

        <ul className="max-h-48 overflow-y-auto rounded-md bg-black/30 divide-y divide-gray-800 mb-4">
          {preview.map((song) => (
            <li key={song.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{song.title}</p>
                <p className="text-xs text-spotify-lightGray truncate">
                  {song.fileName || song.relativePath || song.artist}
                </p>
              </div>
            </li>
          ))}
          {remaining > 0 && (
            <li className="px-3 py-2 text-xs text-spotify-lightGray">
              + {remaining} more {remaining === 1 ? 'song' : 'songs'}
            </li>
          )}
        </ul>

        {error && (
          <p className="text-xs text-red-400 mb-4">{error}</p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onDismiss}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-spotify-lightGray hover:text-white transition-colors disabled:opacity-50"
          >
            Not now
          </button>
          <button
            onClick={onRemove}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-white bg-red-600/80 hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            Remove {songs.length === 1 ? 'song' : 'songs'}
          </button>
          {canReconnect && (
            <button
              onClick={onReconnect}
              disabled={busy}
              className="px-4 py-2 rounded-full text-sm font-medium text-white border border-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
              Reconnect folder
            </button>
          )}
          <button
            onClick={onLocateFolder}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-black bg-spotify-green hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {busy ? 'Searching…' : 'Locate folder'}
          </button>
        </div>

        <p className="text-[11px] text-spotify-lightGray mt-4">
          Tip: songs added with “Open Music File” are restored automatically. Folder songs
          need their folder reconnected after a refresh.
        </p>
      </div>
    </div>
  );
};

export default MissingSongsDialog;
