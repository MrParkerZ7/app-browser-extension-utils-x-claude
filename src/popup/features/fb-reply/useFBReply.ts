import { useState, useEffect, useCallback } from 'react';
import {
  FBAutoReplyState,
  FBReplySteps,
  FBReplyTemplate,
  FBTab,
  FBAutoReplyConfig,
} from '../../../shared/types';
import { sendMessage } from '../../hooks';

export interface FBReplyActions {
  steps: FBReplySteps;
  templates: FBReplyTemplate[];
  activeTemplateIndex: number;
  doClose: boolean;
  delayMin: number;
  delayMax: number;
}

const DEFAULT_ACTIONS: FBReplyActions = {
  steps: { clickReply: true, inputText: true, uploadImages: false, submitReply: true },
  templates: [{ message: 'hello world', imageUrls: [] }],
  activeTemplateIndex: 0,
  doClose: true,
  delayMin: 1500,
  delayMax: 3000,
};

export function useFBReply() {
  const [state, setState] = useState<FBAutoReplyState>({
    running: false,
    tabs: [],
    completed: 0,
    total: 0,
  });

  const [actions, setActions] = useState<FBReplyActions>(DEFAULT_ACTIONS);
  const [status, setStatus] = useState<{
    message: string;
    type: 'error' | 'info' | 'warning';
  } | null>(null);

  // Define callbacks first (before useEffects that use them)
  const applyState = useCallback((newState: FBAutoReplyState) => {
    setState(prevState => {
      const wasRunning = prevState.running;

      // Show status messages based on state changes
      if (newState.running && !wasRunning) {
        setStatus({ message: 'Running...', type: 'info' });
      } else if (!newState.running && wasRunning) {
        if (newState.completed > 0) {
          setStatus({
            message: `Completed. ${newState.completed}/${newState.total} successful.`,
            type: 'info',
          });
        }
      }

      return newState;
    });
  }, []);

  const showStatus = useCallback((message: string, type: 'error' | 'info' | 'warning') => {
    setStatus({ message, type });
  }, []);

  const hideStatus = useCallback(() => {
    setStatus(null);
  }, []);

  // Load saved settings
  useEffect(() => {
    chrome.storage.local
      .get([
        'fbTemplates',
        'fbActiveTemplateIndex',
        'fbReplyDelayMin',
        'fbReplyDelayMax',
        'fbStepClickReply',
        'fbStepInputText',
        'fbStepUploadImages',
        'fbStepSubmit',
        'fbActionClose',
      ])
      .then(stored => {
        const newActions = { ...DEFAULT_ACTIONS };

        if (stored.fbTemplates && stored.fbTemplates.length > 0) {
          newActions.templates = stored.fbTemplates;
        }
        if (
          stored.fbActiveTemplateIndex !== undefined &&
          stored.fbActiveTemplateIndex < newActions.templates.length
        ) {
          newActions.activeTemplateIndex = stored.fbActiveTemplateIndex;
        }
        if (stored.fbReplyDelayMin) newActions.delayMin = parseInt(stored.fbReplyDelayMin, 10);
        if (stored.fbReplyDelayMax) newActions.delayMax = parseInt(stored.fbReplyDelayMax, 10);
        if (stored.fbStepClickReply !== undefined)
          newActions.steps.clickReply = stored.fbStepClickReply;
        if (stored.fbStepInputText !== undefined)
          newActions.steps.inputText = stored.fbStepInputText;
        if (stored.fbStepUploadImages !== undefined)
          newActions.steps.uploadImages = stored.fbStepUploadImages;
        if (stored.fbStepSubmit !== undefined) newActions.steps.submitReply = stored.fbStepSubmit;
        if (stored.fbActionClose !== undefined) newActions.doClose = stored.fbActionClose;

        setActions(newActions);
      });
  }, []);

  // Get initial state from background
  useEffect(() => {
    sendMessage({ type: 'FB_GET_STATE' }).then(response => {
      if (response?.success && response.data) {
        const currentState = response.data as FBAutoReplyState;
        applyState(currentState);

        // Only scan tabs if not currently running (to avoid resetting progress)
        if (!currentState.running) {
          sendMessage({ type: 'FB_SCAN_TABS' });
        }
      } else {
        // No state yet, do initial scan
        sendMessage({ type: 'FB_SCAN_TABS' });
      }
    });
  }, [applyState]);

  // Listen for state updates from background
  useEffect(() => {
    const listener = (message: { type: string; payload?: FBAutoReplyState }) => {
      if (message.type === 'FB_STATE_UPDATE' && message.payload) {
        applyState(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [applyState]);

  // Actions
  const scanTabs = useCallback(async () => {
    hideStatus();
    const response = await sendMessage({ type: 'FB_SCAN_TABS' });
    if (response?.success) {
      const tabs = response.data as FBTab[];
      if (tabs.length > 0) {
        showStatus(`Found ${tabs.length} FB comment tab(s) ready to reply.`, 'info');
      } else {
        showStatus('No Facebook comment tabs found.', 'warning');
      }
    }
  }, [hideStatus, showStatus]);

  const startAutoReply = useCallback(async () => {
    const { steps, templates, doClose, delayMin, delayMax } = actions;

    const hasAnyStep =
      steps.clickReply || steps.inputText || steps.uploadImages || steps.submitReply;
    if (!hasAnyStep && !doClose) {
      showStatus('Please select at least one action.', 'error');
      return;
    }

    if (steps.inputText || steps.uploadImages) {
      const validTemplates = templates.filter(t => {
        const hasMessage = !steps.inputText || t.message.trim() !== '';
        const hasImages = !steps.uploadImages || t.imageUrls.some(url => url.trim() !== '');
        return hasMessage && hasImages;
      });

      if (validTemplates.length === 0) {
        if (steps.inputText && steps.uploadImages) {
          showStatus('Please add at least one template with message and image.', 'error');
        } else if (steps.inputText) {
          showStatus('Please add at least one template with a message.', 'error');
        } else {
          showStatus('Please add at least one template with an image URL.', 'error');
        }
        return;
      }
    }

    const config: FBAutoReplyConfig = {
      templates,
      delayMin,
      delayMax,
      steps,
      doClose,
    };

    const response = await sendMessage({ type: 'FB_START_AUTO_REPLY', payload: config });
    if (response?.success) {
      showStatus('Starting...', 'info');
    } else {
      showStatus(response?.error || 'Failed to start', 'error');
    }
  }, [actions, showStatus]);

  const stopAutoReply = useCallback(async () => {
    showStatus('Stopping...', 'warning');
    await sendMessage({ type: 'FB_STOP_AUTO_REPLY' });
  }, [showStatus]);

  const selectAllTabs = useCallback(async () => {
    await sendMessage({ type: 'FB_SELECT_ALL_TABS', payload: { selected: true } });
  }, []);

  const deselectAllTabs = useCallback(async () => {
    await sendMessage({ type: 'FB_SELECT_ALL_TABS', payload: { selected: false } });
  }, []);

  const selectTab = useCallback(async (tabId: number, selected: boolean) => {
    await sendMessage({ type: 'FB_SELECT_TAB', payload: { tabId, selected } });
  }, []);

  // Settings updates
  const updateSteps = useCallback((steps: FBReplySteps) => {
    setActions(prev => ({ ...prev, steps }));
    chrome.storage.local.set({
      fbStepClickReply: steps.clickReply,
      fbStepInputText: steps.inputText,
      fbStepUploadImages: steps.uploadImages,
      fbStepSubmit: steps.submitReply,
    });
  }, []);

  const updateDoClose = useCallback((doClose: boolean) => {
    setActions(prev => ({ ...prev, doClose }));
    chrome.storage.local.set({ fbActionClose: doClose });
  }, []);

  const updateDelays = useCallback((delayMin: number, delayMax: number) => {
    setActions(prev => ({ ...prev, delayMin, delayMax }));
    chrome.storage.local.set({
      fbReplyDelayMin: String(delayMin),
      fbReplyDelayMax: String(delayMax),
    });
  }, []);

  const updateTemplates = useCallback(
    (templates: FBReplyTemplate[], activeTemplateIndex?: number) => {
      const newIndex = activeTemplateIndex ?? actions.activeTemplateIndex;
      setActions(prev => ({
        ...prev,
        templates,
        activeTemplateIndex: Math.min(newIndex, templates.length - 1),
      }));
      chrome.storage.local.set({
        fbTemplates: templates,
        fbActiveTemplateIndex: Math.min(newIndex, templates.length - 1),
      });
    },
    [actions.activeTemplateIndex]
  );

  const setActiveTemplateIndex = useCallback((index: number) => {
    setActions(prev => ({ ...prev, activeTemplateIndex: index }));
    chrome.storage.local.set({ fbActiveTemplateIndex: index });
  }, []);

  // Helper for button label
  const getActionLabel = useCallback(() => {
    const hasAnyStep =
      actions.steps.clickReply ||
      actions.steps.inputText ||
      actions.steps.uploadImages ||
      actions.steps.submitReply;
    if (hasAnyStep && actions.doClose) return 'Reply & Close';
    if (hasAnyStep) return 'Reply';
    if (actions.doClose) return 'Close Tabs';
    return 'Start';
  }, [actions]);

  return {
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
    showStatus,
    hideStatus,
  };
}
