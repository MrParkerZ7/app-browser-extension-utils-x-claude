interface ActionButtonsProps {
  running: boolean;
  hasSelectedPendingTabs: boolean;
  hasProcessingTabs: boolean;
  actionLabel: string;
  showScanButton: boolean;
  onScan: () => void;
  onStart: () => void;
  onStop: () => void;
}

export function ActionButtons({
  running,
  hasSelectedPendingTabs,
  hasProcessingTabs,
  actionLabel,
  showScanButton,
  onScan,
  onStart,
  onStop,
}: ActionButtonsProps) {
  // In tabs mode, require selected tabs; in bookmark mode, allow starting immediately
  const startDisabled = running || (showScanButton && !hasSelectedPendingTabs);
  const startText = running ? (hasProcessingTabs ? 'Running...' : 'Start') : actionLabel;

  return (
    <div className="fb-reply-actions">
      {showScanButton && (
        <button className="btn btn-primary" disabled={running} onClick={onScan}>
          Scan Tabs
        </button>
      )}
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
