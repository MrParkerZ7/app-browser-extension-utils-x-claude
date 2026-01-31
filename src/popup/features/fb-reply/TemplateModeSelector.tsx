import { FBTemplateSelectionMode } from '../../../shared/types';

interface TemplateModeSelectorProps {
  mode: FBTemplateSelectionMode;
  onChange: (mode: FBTemplateSelectionMode) => void;
  disabled: boolean;
}

export function TemplateModeSelector({ mode, onChange, disabled }: TemplateModeSelectorProps) {
  return (
    <div className="fb-reply-settings">
      <label className="fb-reply-label">Template selection mode:</label>
      <div className="fb-mode-radios">
        <label className="fb-mode-radio">
          <input
            type="radio"
            name="fb-template-mode"
            value="random"
            checked={mode === 'random'}
            onChange={() => onChange('random')}
            disabled={disabled}
          />
          <span>Random</span>
        </label>
        <label className="fb-mode-radio">
          <input
            type="radio"
            name="fb-template-mode"
            value="sequential"
            checked={mode === 'sequential'}
            onChange={() => onChange('sequential')}
            disabled={disabled}
          />
          <span>Sequential</span>
        </label>
        <label className="fb-mode-radio">
          <input
            type="radio"
            name="fb-template-mode"
            value="shuffled"
            checked={mode === 'shuffled'}
            onChange={() => onChange('shuffled')}
            disabled={disabled}
          />
          <span>Shuffled</span>
        </label>
      </div>
    </div>
  );
}
