// FB Auto Reply feature state management
import { FBAutoReplyState, FBReplySteps } from '../../../shared/types';
import { renderFBTabs, updateFBButtonStates, updateFBProgress, showFBStatus } from './tabs';

export interface FBActions {
  steps: FBReplySteps;
  close: boolean;
}

// Local UI state
export let fbState: FBAutoReplyState = {
  running: false,
  tabs: [],
  completed: 0,
  total: 0,
};

export let fbActions: FBActions = {
  steps: { clickReply: true, inputText: true, submitReply: true },
  close: true,
};

export function setFBActions(actions: FBActions): void {
  fbActions = actions;
}

export function getActionLabel(): string {
  const hasAnyStep = fbActions.steps.clickReply || fbActions.steps.inputText || fbActions.steps.submitReply;
  if (hasAnyStep && fbActions.close) return 'Reply & Close';
  if (hasAnyStep) return 'Reply';
  if (fbActions.close) return 'Close Tabs';
  return 'Start';
}

// Apply state from background and update UI
export function applyFBState(state: FBAutoReplyState): void {
  const wasRunning = fbState.running;
  fbState = state;

  renderFBTabs();
  updateFBButtonStates();
  updateFBProgress(fbState.completed, fbState.total);

  // Show status messages based on state changes
  if (fbState.running && !wasRunning) {
    showFBStatus('Running...', 'info');
  } else if (!fbState.running && wasRunning) {
    if (fbState.completed > 0) {
      showFBStatus(`Completed. ${fbState.completed}/${fbState.total} successful.`, 'info');
    }
  }
}
