// CSS Counter feature state management
import { generateId } from '../../../shared/utils';

export interface SearchItem {
  id: string;
  query: string;
  classes: number;
  textMatches: number;
}

export let searchItems: SearchItem[] = [];

export function setSearchItems(items: SearchItem[]): void {
  searchItems = items;
}

export function addSearchItemToState(item: SearchItem): void {
  searchItems.push(item);
}

export function removeSearchItem(id: string): void {
  searchItems = searchItems.filter(i => i.id !== id);
}

export function updateSearchItemQuery(id: string, query: string): void {
  const item = searchItems.find(i => i.id === id);
  if (item) {
    item.query = query;
  }
}

export function updateSearchItemResults(id: string, classes: number, textMatches: number): void {
  const item = searchItems.find(i => i.id === id);
  if (item) {
    item.classes = classes;
    item.textMatches = textMatches;
  }
}

export async function saveSearchItems(): Promise<void> {
  await chrome.storage.local.set({
    searchItems: searchItems.map(i => ({ id: i.id, query: i.query }))
  });
}

export async function loadSearchItems(): Promise<void> {
  const stored = await chrome.storage.local.get('searchItems');
  if (stored.searchItems && Array.isArray(stored.searchItems)) {
    searchItems = stored.searchItems.map((i: { id: string; query: string }) => ({
      id: i.id,
      query: i.query,
      classes: 0,
      textMatches: 0,
    }));
  }

  // Add default item if empty
  if (searchItems.length === 0) {
    searchItems.push({
      id: generateId(),
      query: '',
      classes: 0,
      textMatches: 0,
    });
  }
}
