// CSS Counter feature entry point
import { loadSearchItems } from './state';
import { renderSearchList, performAllSearches, addSearchItem } from './search';

export async function setupCSSCounter(): Promise<void> {
  const addBtn = document.getElementById('addSearchBtn') as HTMLButtonElement;
  const recountBtn = document.getElementById('recountBtn') as HTMLButtonElement;

  // Load saved search items
  await loadSearchItems();

  // Render the search list
  renderSearchList();

  // Perform initial search
  performAllSearches();

  // Add button
  addBtn.addEventListener('click', () => {
    addSearchItem();
  });

  // Re-count all button
  recountBtn.addEventListener('click', () => {
    performAllSearches();
  });
}
