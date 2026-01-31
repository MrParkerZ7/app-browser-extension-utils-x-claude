import { BookmarkFolder } from '../../../shared/types';

interface BookmarkFolderSelectorProps {
  folders: BookmarkFolder[];
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onRefresh: () => void;
  disabled: boolean;
}

export function BookmarkFolderSelector({
  folders,
  selectedId,
  onSelect,
  onRefresh,
  disabled,
}: BookmarkFolderSelectorProps) {
  return (
    <div className="fb-reply-settings">
      <div className="fb-bookmark-folder-header">
        <label className="fb-reply-label">Bookmark folder:</label>
        <button
          className="btn btn-small btn-secondary"
          onClick={onRefresh}
          disabled={disabled}
          type="button"
        >
          Refresh
        </button>
      </div>
      <select
        className="fb-bookmark-folder-select"
        value={selectedId || ''}
        onChange={e => onSelect(e.target.value || null)}
        disabled={disabled}
      >
        <option value="">-- Select a folder --</option>
        {folders.map(folder => (
          <option key={folder.id} value={folder.id}>
            {folder.path}
          </option>
        ))}
      </select>
    </div>
  );
}
