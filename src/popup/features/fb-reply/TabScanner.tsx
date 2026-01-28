import { FBTab } from '../../../shared/types';

interface TabScannerProps {
  tabs: FBTab[];
  running: boolean;
  onSelectTab: (tabId: number, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  done: 'Done',
  error: 'Error',
};

export function TabScanner({
  tabs,
  running,
  onSelectTab,
  onSelectAll,
  onDeselectAll,
}: TabScannerProps) {
  const selectedCount = tabs.filter(t => t.selected && t.status === 'pending').length;
  const hasTabs = tabs.length > 0;

  return (
    <div className="fb-reply-tabs">
      <div className="fb-tabs-header">
        <div className="fb-reply-label">
          Facebook Tabs Found: <span>{tabs.length}</span> (Selected: <span>{selectedCount}</span>)
        </div>
        <div className="fb-tabs-select-actions">
          <button className="btn btn-small" disabled={running || !hasTabs} onClick={onSelectAll}>
            Select All
          </button>
          <button className="btn btn-small" disabled={running || !hasTabs} onClick={onDeselectAll}>
            Deselect All
          </button>
        </div>
      </div>
      <div className="fb-tabs-list">
        {tabs.map((tab, index) => {
          const isDisabled = tab.status !== 'pending' || running;
          const classNames = [
            'fb-tab-item',
            tab.status,
            tab.status === 'done' ? 'completed' : '',
            tab.status === 'processing' ? 'current' : '',
            tab.status === 'error' ? 'failed' : '',
            !tab.selected ? 'unselected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={tab.id} className={classNames}>
              <input
                type="checkbox"
                className="fb-tab-checkbox"
                checked={tab.selected}
                disabled={isDisabled}
                onChange={e => onSelectTab(tab.id, e.target.checked)}
              />
              <span className="fb-tab-index">#{index + 1}</span>
              <span className="fb-tab-title" title={tab.url}>
                {tab.title || 'Facebook Tab'}
              </span>
              <span className={`fb-tab-status ${tab.status}`}>
                {statusLabels[tab.status] || tab.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
