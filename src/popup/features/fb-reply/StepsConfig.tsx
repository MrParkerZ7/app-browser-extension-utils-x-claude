import { FBReplySteps } from '../../../shared/types';

interface StepsConfigProps {
  steps: FBReplySteps;
  doClose: boolean;
  onStepsChange: (steps: FBReplySteps) => void;
  onDoCloseChange: (doClose: boolean) => void;
}

export function StepsConfig({ steps, doClose, onStepsChange, onDoCloseChange }: StepsConfigProps) {
  const handleStepChange = (key: keyof FBReplySteps, value: boolean) => {
    onStepsChange({ ...steps, [key]: value });
  };

  return (
    <>
      <div className="fb-reply-settings">
        <label className="fb-reply-label">Reply steps to perform:</label>
        <div className="fb-action-checkboxes">
          <label className="fb-action-checkbox">
            <input
              type="checkbox"
              checked={steps.clickReply}
              onChange={e => handleStepChange('clickReply', e.target.checked)}
            />
            <span>Click Reply button</span>
          </label>
          <label className="fb-action-checkbox">
            <input
              type="checkbox"
              checked={steps.inputText}
              onChange={e => handleStepChange('inputText', e.target.checked)}
            />
            <span>Input text</span>
          </label>
          <label className="fb-action-checkbox">
            <input
              type="checkbox"
              checked={steps.uploadImages}
              onChange={e => handleStepChange('uploadImages', e.target.checked)}
            />
            <span>Upload images</span>
          </label>
          <label className="fb-action-checkbox">
            <input
              type="checkbox"
              checked={steps.submitReply}
              onChange={e => handleStepChange('submitReply', e.target.checked)}
            />
            <span>Submit reply</span>
          </label>
        </div>
      </div>

      <div className="fb-reply-settings">
        <label className="fb-reply-label">After completion:</label>
        <div className="fb-action-checkboxes">
          <label className="fb-action-checkbox">
            <input
              type="checkbox"
              checked={doClose}
              onChange={e => onDoCloseChange(e.target.checked)}
            />
            <span>Close tab</span>
          </label>
        </div>
      </div>
    </>
  );
}
