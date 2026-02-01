import type { TabId } from '../App';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'tab-logging', label: 'Logging' },
  { id: 'tab-css-counter', label: 'HTML Counter' },
  { id: 'tab-fb-reply', label: 'FB Auto' },
  { id: 'tab-idm', label: 'Video DL' },
  { id: 'tab-image', label: 'Image DL' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
