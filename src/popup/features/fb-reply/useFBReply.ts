import { useState, useEffect, useCallback } from 'react';
import {
  FBAutoReplyState,
  FBReplySteps,
  FBReplyTemplate,
  FBTab,
  FBAutoReplyConfig,
  FBAutoReplyMode,
  BookmarkFolder,
  FBTemplateSelectionMode,
} from '../../../shared/types';
import { sendMessage } from '../../hooks';

export interface FBReplyActions {
  steps: FBReplySteps;
  templates: FBReplyTemplate[];
  activeTemplateIndex: number;
  selectedTemplateIndices: number[];
  doClose: boolean;
  delayMin: number;
  delayMax: number;
}

const DEFAULT_ACTIONS: FBReplyActions = {
  steps: { clickReply: true, inputText: true, uploadImages: false, submitReply: true },
  templates: [{ message: 'hello world', imageUrls: [] }],
  activeTemplateIndex: 0,
  selectedTemplateIndices: [0],
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
    mode: 'tabs',
    skippedBookmarks: 0,
  });

  const [mode, setMode] = useState<FBAutoReplyMode>('tabs');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [templateMode, setTemplateMode] = useState<FBTemplateSelectionMode>('random');

  const [actions, setActions] = useState<FBReplyActions>(DEFAULT_ACTIONS);
  const [status, setStatus] = useState<{
    message: string;
    type: 'error' | 'info' | 'warning';
  } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        'fbSelectedTemplateIndices',
        'fbReplyDelayMin',
        'fbReplyDelayMax',
        'fbStepClickReply',
        'fbStepInputText',
        'fbStepUploadImages',
        'fbStepSubmit',
        'fbActionClose',
        'fbReplySectionCollapsed',
        'fbReplyMode',
        'fbSelectedFolderId',
        'fbTemplateMode',
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
        if (stored.fbSelectedTemplateIndices && Array.isArray(stored.fbSelectedTemplateIndices)) {
          // Filter to only include valid indices
          newActions.selectedTemplateIndices = stored.fbSelectedTemplateIndices.filter(
            (i: number) => i >= 0 && i < newActions.templates.length
          );
        } else {
          // Default: select all templates
          newActions.selectedTemplateIndices = newActions.templates.map((_, i) => i);
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
        if (stored.fbReplySectionCollapsed !== undefined)
          setIsCollapsed(stored.fbReplySectionCollapsed);
        if (stored.fbReplyMode) setMode(stored.fbReplyMode);
        if (stored.fbSelectedFolderId) setSelectedFolderId(stored.fbSelectedFolderId);
        if (stored.fbTemplateMode) setTemplateMode(stored.fbTemplateMode);

        setActions(newActions);

        // Load bookmark folders if in bookmark mode
        if (stored.fbReplyMode === 'bookmarks') {
          loadBookmarkFolders();
        }
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
    const { steps, templates, selectedTemplateIndices, doClose, delayMin, delayMax } = actions;

    const hasAnyStep =
      steps.clickReply || steps.inputText || steps.uploadImages || steps.submitReply;
    if (!hasAnyStep && !doClose) {
      showStatus('Please select at least one action.', 'error');
      return;
    }

    // Validate bookmark mode requirements
    if (mode === 'bookmarks' && !selectedFolderId) {
      showStatus('Please select a bookmark folder.', 'error');
      return;
    }

    // Filter to only selected templates
    const selectedTemplates = templates.filter((_, i) => selectedTemplateIndices.includes(i));

    if (steps.inputText || steps.uploadImages) {
      if (selectedTemplates.length === 0) {
        showStatus('Please select at least one template.', 'error');
        return;
      }

      const validTemplates = selectedTemplates.filter(t => {
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
      templates: selectedTemplates,
      delayMin,
      delayMax,
      steps,
      doClose,
      mode,
      bookmarkFolderId: mode === 'bookmarks' ? (selectedFolderId ?? undefined) : undefined,
      templateMode,
    };

    const response = await sendMessage({ type: 'FB_START_AUTO_REPLY', payload: config });
    if (response?.success) {
      showStatus('Starting...', 'info');
    } else {
      showStatus(response?.error || 'Failed to start', 'error');
    }
  }, [actions, showStatus, mode, selectedFolderId, templateMode]);

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
    (templates: FBReplyTemplate[], activeTemplateIndex?: number, selectedIndices?: number[]) => {
      const newIndex = activeTemplateIndex ?? actions.activeTemplateIndex;
      const newSelectedIndices =
        selectedIndices ??
        // When adding new template, auto-select it; when removing, filter out invalid indices
        actions.selectedTemplateIndices.filter(i => i < templates.length);

      // If a new template was added (templates grew), auto-select the new one
      const finalSelectedIndices =
        templates.length > actions.templates.length
          ? [...newSelectedIndices, templates.length - 1]
          : newSelectedIndices;

      setActions(prev => ({
        ...prev,
        templates,
        activeTemplateIndex: Math.min(newIndex, templates.length - 1),
        selectedTemplateIndices: finalSelectedIndices,
      }));
      chrome.storage.local.set({
        fbTemplates: templates,
        fbActiveTemplateIndex: Math.min(newIndex, templates.length - 1),
        fbSelectedTemplateIndices: finalSelectedIndices,
      });
    },
    [actions.activeTemplateIndex, actions.selectedTemplateIndices, actions.templates.length]
  );

  const setActiveTemplateIndex = useCallback((index: number) => {
    setActions(prev => ({ ...prev, activeTemplateIndex: index }));
    chrome.storage.local.set({ fbActiveTemplateIndex: index });
  }, []);

  const toggleTemplateSelection = useCallback((index: number) => {
    setActions(prev => {
      const isSelected = prev.selectedTemplateIndices.includes(index);
      const newIndices = isSelected
        ? prev.selectedTemplateIndices.filter(i => i !== index)
        : [...prev.selectedTemplateIndices, index].sort((a, b) => a - b);
      chrome.storage.local.set({ fbSelectedTemplateIndices: newIndices });
      return { ...prev, selectedTemplateIndices: newIndices };
    });
  }, []);

  const selectAllTemplates = useCallback(() => {
    setActions(prev => {
      const allIndices = prev.templates.map((_, i) => i);
      chrome.storage.local.set({ fbSelectedTemplateIndices: allIndices });
      return { ...prev, selectedTemplateIndices: allIndices };
    });
  }, []);

  const deselectAllTemplates = useCallback(() => {
    setActions(prev => {
      chrome.storage.local.set({ fbSelectedTemplateIndices: [] });
      return { ...prev, selectedTemplateIndices: [] };
    });
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

  const toggleCollapsed = useCallback(() => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    chrome.storage.local.set({ fbReplySectionCollapsed: newValue });
  }, [isCollapsed]);

  // Bookmark mode functions
  const loadBookmarkFolders = useCallback(async () => {
    const response = await sendMessage({ type: 'FB_GET_BOOKMARK_FOLDERS' });
    if (response?.success && response.data) {
      setBookmarkFolders(response.data as BookmarkFolder[]);
    }
  }, []);

  const updateMode = useCallback(
    (newMode: FBAutoReplyMode) => {
      setMode(newMode);
      chrome.storage.local.set({ fbReplyMode: newMode });

      // Load bookmark folders when switching to bookmark mode
      if (newMode === 'bookmarks') {
        loadBookmarkFolders();
      }
    },
    [loadBookmarkFolders]
  );

  const updateSelectedFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
    if (folderId) {
      chrome.storage.local.set({ fbSelectedFolderId: folderId });
    } else {
      chrome.storage.local.remove('fbSelectedFolderId');
    }
  }, []);

  const updateTemplateMode = useCallback((newMode: FBTemplateSelectionMode) => {
    setTemplateMode(newMode);
    chrome.storage.local.set({ fbTemplateMode: newMode });
  }, []);

  return {
    state,
    actions,
    status,
    isCollapsed,
    mode,
    selectedFolderId,
    bookmarkFolders,
    templateMode,
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
    toggleTemplateSelection,
    selectAllTemplates,
    deselectAllTemplates,
    getActionLabel,
    toggleCollapsed,
    showStatus,
    hideStatus,
    loadBookmarkFolders,
    updateMode,
    updateSelectedFolder,
    updateTemplateMode,
  };
}
