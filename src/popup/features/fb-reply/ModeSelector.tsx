import { FBAutoReplyMode } from '../../../shared/types';

interface ModeSelectorProps {
  mode: FBAutoReplyMode;
  onChange: (mode: FBAutoReplyMode) => void;
  disabled: boolean;
}

export function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="fb-reply-settings">
      <label className="fb-reply-label">Source mode:</label>
      <div className="fb-mode-radios">
        <label className="fb-mode-radio">
          <input
            type="radio"
            name="fb-reply-mode"
            value="tabs"
            checked={mode === 'tabs'}
            onChange={() => onChange('tabs')}
            disabled={disabled}
          />
          <span>Scan Open Tabs</span>
        </label>
        <label className="fb-mode-radio">
          <input
            type="radio"
            name="fb-reply-mode"
            value="bookmarks"
            checked={mode === 'bookmarks'}
            onChange={() => onChange('bookmarks')}
            disabled={disabled}
          />
          <span>From Bookmark Folder</span>
        </label>
      </div>
    </div>
  );
}
