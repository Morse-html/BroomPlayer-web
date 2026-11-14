import { useState, useEffect } from 'react';

interface PlaylistContextMenuProps {
  x: number;
  y: number;
  playlist: any;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const PlaylistContextMenu = ({
  x,
  y,
  onRename,
  onDelete,
  onClose,
}: PlaylistContextMenuProps) => {
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 150);
    setPosition({ x: adjustedX, y: adjustedY });
  }, [x, y]);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        style={{ left: position.x, top: position.y }}
        className="fixed z-50 w-56 bg-gray-900 border border-gray-700 rounded-md shadow-2xl py-1"
      >
        <button
          onClick={onRename}
          className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 text-sm transition-colors"
        >
          Rename
        </button>
        <button
          onClick={onDelete}
          className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 text-sm transition-colors"
        >
          Delete
        </button>
      </div>
    </>
  );
};

export default PlaylistContextMenu;