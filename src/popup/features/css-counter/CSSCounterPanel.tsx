import { useState, useEffect, useCallback } from 'react';
import { useCSSCounter } from './useCSSCounter';
import { SearchItem } from './SearchItem';

export function CSSCounterPanel() {
  const {
    searchItems,
    status,
    addItem,
    removeItem,
    updateQuery,
    performSearchForItem,
    performAllSearches,
  } = useCSSCounter();

  const [newItemId, setNewItemId] = useState<string | null>(null);

  // Perform initial search when items are loaded
  useEffect(() => {
    if (searchItems.length > 0) {
      performAllSearches();
    }
  }, []); // Only run once on mount

  const handleAddItem = useCallback(() => {
    const id = addItem();
    setNewItemId(id);
  }, [addItem]);

  return (
    <div id="tab-css-counter" className="tab-panel active">
      <div className="css-counter-container">
        <div className="css-counter-header">
          <h2>HTML Counter</h2>
          <button className="btn btn-primary" onClick={performAllSearches}>
            Re-count All
          </button>
        </div>
        {status && (
          <div className={`css-counter-status visible ${status.type}`}>{status.message}</div>
        )}
        <div className="search-list">
          {searchItems.map(item => (
            <SearchItem
              key={item.id}
              item={item}
              onQueryChange={updateQuery}
              onRemove={removeItem}
              onSearch={performSearchForItem}
              autoFocus={item.id === newItemId}
            />
          ))}
        </div>
        <div className="add-search-row">
          <button className="btn-icon btn-add" onClick={handleAddItem}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
