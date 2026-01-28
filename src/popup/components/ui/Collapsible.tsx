import { useState, ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  defaultCollapsed?: boolean;
  storageKey?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function Collapsible({
  title,
  defaultCollapsed = false,
  storageKey,
  className = '',
  headerClassName = '',
  contentClassName = '',
  children,
}: CollapsibleProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (storageKey) {
      // Load from storage synchronously is not possible, so we'll use effect
      return defaultCollapsed;
    }
    return defaultCollapsed;
  });

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (storageKey) {
      chrome.storage.local.set({ [storageKey]: newState });
    }
  };

  // Load initial state from storage
  useState(() => {
    if (storageKey) {
      chrome.storage.local.get([storageKey]).then(result => {
        if (result[storageKey] !== undefined) {
          setIsCollapsed(result[storageKey]);
        }
      });
    }
  });

  return (
    <div className={className}>
      <div
        className={`${headerClassName} ${isCollapsed ? 'collapsed' : ''}`}
        onClick={handleToggle}
        style={{ cursor: 'pointer' }}
      >
        <svg
          className="fb-notif-collapse-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>{title}</span>
      </div>
      <div className={`${contentClassName} ${isCollapsed ? 'collapsed' : ''}`}>{children}</div>
    </div>
  );
}
