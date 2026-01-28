import { useState, useEffect, useCallback } from 'react';
import { CSSSearchResult } from '../../../shared/types';
import { generateId } from '../../../shared/utils';

export interface SearchItem {
  id: string;
  query: string;
  classes: number;
  textMatches: number;
}

export function useCSSCounter() {
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  // Load search items from storage
  useEffect(() => {
    chrome.storage.local.get('searchItems').then(result => {
      if (result.searchItems && Array.isArray(result.searchItems)) {
        const items = result.searchItems.map((i: { id: string; query: string }) => ({
          id: i.id,
          query: i.query,
          classes: 0,
          textMatches: 0,
        }));
        setSearchItems(items.length > 0 ? items : [createNewItem()]);
      } else {
        setSearchItems([createNewItem()]);
      }
    });
  }, []);

  const createNewItem = (): SearchItem => ({
    id: generateId(),
    query: '',
    classes: 0,
    textMatches: 0,
  });

  const saveItems = useCallback((items: SearchItem[]) => {
    chrome.storage.local.set({
      searchItems: items.map(i => ({ id: i.id, query: i.query })),
    });
  }, []);

  const showStatus = useCallback((message: string, type: 'error' | 'info') => {
    setStatus({ message, type });
  }, []);

  const hideStatus = useCallback(() => {
    setStatus(null);
  }, []);

  const performSearchForItem = useCallback(async (id: string, query: string): Promise<void> => {
    if (!query.trim()) {
      setSearchItems(prev =>
        prev.map(item => (item.id === id ? { ...item, classes: 0, textMatches: 0 } : item))
      );
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('about:')
    ) {
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CSS_SEARCH',
        payload: { query },
      });

      if (response?.success && response.data) {
        const result = response.data as CSSSearchResult;
        setSearchItems(prev =>
          prev.map(item =>
            item.id === id
              ? { ...item, classes: result.classes, textMatches: result.textMatches }
              : item
          )
        );
      }
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/index.js'],
        });
        await new Promise(resolve => setTimeout(resolve, 100));

        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'CSS_SEARCH',
          payload: { query },
        });

        if (response?.success && response.data) {
          const result = response.data as CSSSearchResult;
          setSearchItems(prev =>
            prev.map(item =>
              item.id === id
                ? { ...item, classes: result.classes, textMatches: result.textMatches }
                : item
            )
          );
        }
      } catch {
        // Silently fail for individual items
      }
    }
  }, []);

  const performAllSearches = useCallback(async () => {
    hideStatus();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showStatus('No active tab found', 'error');
      return;
    }

    if (
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('about:')
    ) {
      showStatus('Cannot search on browser internal pages', 'error');
      return;
    }

    for (const item of searchItems) {
      await performSearchForItem(item.id, item.query);
    }
  }, [searchItems, performSearchForItem, hideStatus, showStatus]);

  const addItem = useCallback(() => {
    const newItem = createNewItem();
    setSearchItems(prev => {
      const newItems = [...prev, newItem];
      saveItems(newItems);
      return newItems;
    });
    return newItem.id;
  }, [saveItems]);

  const removeItem = useCallback(
    (id: string) => {
      setSearchItems(prev => {
        const newItems = prev.filter(item => item.id !== id);
        saveItems(newItems);
        return newItems;
      });
    },
    [saveItems]
  );

  const updateQuery = useCallback(
    (id: string, query: string) => {
      setSearchItems(prev => {
        const newItems = prev.map(item => (item.id === id ? { ...item, query } : item));
        saveItems(newItems);
        return newItems;
      });
    },
    [saveItems]
  );

  return {
    searchItems,
    status,
    addItem,
    removeItem,
    updateQuery,
    performSearchForItem,
    performAllSearches,
    hideStatus,
  };
}
