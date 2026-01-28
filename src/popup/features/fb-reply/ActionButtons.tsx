interface ActionButtonsProps {
  running: boolean;
  hasSelectedPendingTabs: boolean;
  hasProcessingTabs: boolean;
  actionLabel: string;
  onScan: () => void;
  onStart: () => void;
  onStop: () => void;
}

export function ActionButtons({
  running,
  hasSelectedPendingTabs,
  hasProcessingTabs,
  actionLabel,
  onScan,
  onStart,
  onStop,
}: ActionButtonsProps) {
  const startDisabled = running || !hasSelectedPendingTabs;
  const startText = running ? (hasProcessingTabs ? 'Running...' : 'Start') : actionLabel;

  return (
    <div className="fb-reply-actions">
      <button className="btn btn-primary" disabled={running} onClick={onScan}>
        Scan Tabs
      </button>
      <button className="btn btn-primary" disabled={startDisabled} onClick={onStart}>
        {startText}
      </button>
      <button
        className="btn btn-danger"
        style={{ display: running ? 'inline-block' : 'none' }}
        onClick={onStop}
      >
        Stop
      </button>
    </div>
  );
}
