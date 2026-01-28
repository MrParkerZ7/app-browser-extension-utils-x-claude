import { useFBReply } from './useFBReply';
import { StepsConfig } from './StepsConfig';
import { TemplateManager } from './TemplateManager';
import { TabScanner } from './TabScanner';
import { ActionButtons } from './ActionButtons';
import { NotifListenerPanel } from '../fb-notif-listener/NotifListenerPanel';

export function FBReplyPanel() {
  const {
    state,
    actions,
    status,
    scanTabs,
    startAutoReply,
    stopAutoReply,
    selectAllTabs,
    deselectAllTabs,
    selectTab,
    updateSteps,
    updateDoClose,
    updateDelays,
    updateTemplates,
    setActiveTemplateIndex,
    getActionLabel,
  } = useFBReply();

  const hasSelectedPendingTabs = state.tabs.some(t => t.status === 'pending' && t.selected);
  const hasProcessingTabs = state.tabs.some(t => t.status === 'processing');

  const handleDelayMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 1500;
    updateDelays(value, actions.delayMax);
  };

  const handleDelayMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 3000;
    updateDelays(actions.delayMin, value);
  };

  return (
    <div id="tab-fb-reply" className="tab-panel active">
      <div className="fb-reply-container">
        <div className="fb-reply-header">
          <h2>FB Auto Reply</h2>
        </div>
        <p className="fb-reply-desc">
          Perform actions on Facebook comment tabs (URLs with comment_id).
        </p>

        <StepsConfig
          steps={actions.steps}
          doClose={actions.doClose}
          onStepsChange={updateSteps}
          onDoCloseChange={updateDoClose}
        />

        <TemplateManager
          templates={actions.templates}
          activeIndex={actions.activeTemplateIndex}
          steps={actions.steps}
          onTemplatesChange={updateTemplates}
          onActiveIndexChange={setActiveTemplateIndex}
        />

        <div className="fb-reply-settings">
          <label className="fb-reply-label">Delay between replies (ms):</label>
          <div className="fb-delay-range">
            <input
              type="number"
              className="fb-reply-input fb-delay-input"
              value={actions.delayMin}
              min={500}
              max={10000}
              onChange={handleDelayMinChange}
            />
            <span className="fb-delay-separator">to</span>
            <input
              type="number"
              className="fb-reply-input fb-delay-input"
              value={actions.delayMax}
              min={500}
              max={10000}
              onChange={handleDelayMaxChange}
            />
          </div>
        </div>

        {status && <div className={`fb-reply-status visible ${status.type}`}>{status.message}</div>}

        <TabScanner
          tabs={state.tabs}
          running={state.running}
          onSelectTab={selectTab}
          onSelectAll={selectAllTabs}
          onDeselectAll={deselectAllTabs}
        />

        <ActionButtons
          running={state.running}
          hasSelectedPendingTabs={hasSelectedPendingTabs}
          hasProcessingTabs={hasProcessingTabs}
          actionLabel={getActionLabel()}
          onScan={scanTabs}
          onStart={startAutoReply}
          onStop={stopAutoReply}
        />

        {state.total > 0 && (
          <div className="fb-reply-progress visible">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(state.completed / state.total) * 100}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {state.completed} / {state.total} completed
            </div>
          </div>
        )}

        <NotifListenerPanel />
      </div>
    </div>
  );
}
