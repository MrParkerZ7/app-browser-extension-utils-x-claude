import { useCallback } from 'react';
import { FBReplyTemplate, FBReplySteps } from '../../../shared/types';

interface TemplateManagerProps {
  templates: FBReplyTemplate[];
  activeIndex: number;
  selectedIndices: number[];
  steps: FBReplySteps;
  onTemplatesChange: (templates: FBReplyTemplate[], activeIndex?: number) => void;
  onActiveIndexChange: (index: number) => void;
  onToggleSelection: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function TemplateManager({
  templates,
  activeIndex,
  selectedIndices,
  steps,
  onTemplatesChange,
  onActiveIndexChange,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
}: TemplateManagerProps) {
  const currentTemplate = templates[activeIndex] || { message: '', imageUrls: [] };
  const showTemplates = steps.inputText || steps.uploadImages;

  const handleAddTemplate = useCallback(() => {
    const newTemplates = [...templates, { message: '', imageUrls: [] }];
    onTemplatesChange(newTemplates, newTemplates.length - 1);
  }, [templates, onTemplatesChange]);

  const handleRemoveTemplate = useCallback(
    (index: number) => {
      if (templates.length <= 1) return;
      const newTemplates = templates.filter((_, i) => i !== index);
      const newActiveIndex =
        activeIndex >= newTemplates.length
          ? newTemplates.length - 1
          : activeIndex > index
            ? activeIndex - 1
            : activeIndex;
      onTemplatesChange(newTemplates, newActiveIndex);
    },
    [templates, activeIndex, onTemplatesChange]
  );

  const handleSwitchTemplate = useCallback(
    (index: number) => {
      onActiveIndexChange(index);
    },
    [onActiveIndexChange]
  );

  const handleMessageChange = useCallback(
    (message: string) => {
      const newTemplates = templates.map((t, i) => (i === activeIndex ? { ...t, message } : t));
      onTemplatesChange(newTemplates);
    },
    [templates, activeIndex, onTemplatesChange]
  );

  const handleImageUrlChange = useCallback(
    (urlIndex: number, url: string) => {
      const newTemplates = templates.map((t, i) => {
        if (i !== activeIndex) return t;
        const newUrls = [...t.imageUrls];
        newUrls[urlIndex] = url;
        return { ...t, imageUrls: newUrls };
      });
      onTemplatesChange(newTemplates);
    },
    [templates, activeIndex, onTemplatesChange]
  );

  const handleAddImageUrl = useCallback(() => {
    const newTemplates = templates.map((t, i) => {
      if (i !== activeIndex) return t;
      return { ...t, imageUrls: [...t.imageUrls, ''] };
    });
    onTemplatesChange(newTemplates);
  }, [templates, activeIndex, onTemplatesChange]);

  const handleRemoveImageUrl = useCallback(
    (urlIndex: number) => {
      const newTemplates = templates.map((t, i) => {
        if (i !== activeIndex) return t;
        return { ...t, imageUrls: t.imageUrls.filter((_, ui) => ui !== urlIndex) };
      });
      onTemplatesChange(newTemplates);
    },
    [templates, activeIndex, onTemplatesChange]
  );

  if (!showTemplates) return null;

  return (
    <div className="fb-reply-settings">
      <div className="fb-template-header">
        <label className="fb-reply-label">Reply Templates:</label>
        <div className="fb-template-select-actions">
          <button className="btn btn-small btn-secondary" onClick={onSelectAll} title="Select All">
            All
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={onDeselectAll}
            title="Deselect All"
          >
            None
          </button>
        </div>
      </div>
      <div className="fb-template-tabs">
        <div className="fb-template-tabs-header">
          <button className="btn-add-template" title="Add Template" onClick={handleAddTemplate}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          {templates.map((template, index) => {
            const preview = template.message.trim().slice(0, 3) || '...';
            return (
              <div
                key={index}
                className={`fb-template-tab ${index === activeIndex ? 'active' : ''} ${selectedIndices.includes(index) ? 'selected' : 'unselected'}`}
                onClick={() => handleSwitchTemplate(index)}
              >
                <span className="fb-template-tab-label">
                  {index + 1}-{preview}
                </span>
              <div className="fb-template-tab-actions">
                <input
                  type="checkbox"
                  className="fb-template-checkbox"
                  checked={selectedIndices.includes(index)}
                  onChange={e => {
                    e.stopPropagation();
                    onToggleSelection(index);
                  }}
                  onClick={e => e.stopPropagation()}
                  title={selectedIndices.includes(index) ? 'Deselect template' : 'Select template'}
                />
                {templates.length > 1 && (
                  <button
                    className="fb-template-tab-remove"
                    title="Remove template"
                    onClick={e => {
                      e.stopPropagation();
                      handleRemoveTemplate(index);
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>
      <div className="fb-template-content">
        {steps.inputText && (
          <div className="fb-template-message">
            <label className="fb-reply-label-small">Message:</label>
            <textarea
              className="fb-reply-textarea"
              placeholder="Enter your reply message..."
              rows={3}
              value={currentTemplate.message}
              onChange={e => handleMessageChange(e.target.value)}
            />
          </div>
        )}
        {steps.uploadImages && (
          <div className="fb-template-images">
            <label className="fb-reply-label-small">Image URLs (random per reply):</label>
            <div className="fb-image-urls-list">
              {currentTemplate.imageUrls.map((url, urlIndex) => (
                <div key={urlIndex} className="fb-image-url-row">
                  <input
                    type="text"
                    className="fb-image-url-input"
                    value={url}
                    placeholder="https://example.com/image.jpg"
                    onChange={e => handleImageUrlChange(urlIndex, e.target.value)}
                  />
                  <button
                    className="btn-icon btn-remove-image"
                    title="Remove"
                    onClick={() => handleRemoveImageUrl(urlIndex)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-small btn-add-image" onClick={handleAddImageUrl}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Image URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
