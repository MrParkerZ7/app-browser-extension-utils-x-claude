import { useRef, useEffect, useCallback } from 'react';
import type { SearchItem as SearchItemType } from './useCSSCounter';

interface SearchItemProps {
  item: SearchItemType;
  onQueryChange: (id: string, query: string) => void;
  onRemove: (id: string) => void;
  onSearch: (id: string, query: string) => void;
  autoFocus?: boolean;
}

export function SearchItem({
  item,
  onQueryChange,
  onRemove,
  onSearch,
  autoFocus = false,
}: SearchItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      onQueryChange(item.id, query);

      clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        onSearch(item.id, query);
      }, 500);
    },
    [item.id, onQueryChange, onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceRef.current);
        onSearch(item.id, item.query);
      }
    },
    [item.id, item.query, onSearch]
  );

  return (
    <div className="search-item" data-id={item.id}>
      <input
        ref={inputRef}
        type="text"
        className="css-input"
        placeholder="Enter class or text to search..."
        spellCheck={false}
        value={item.query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
      />
      <div className="search-results">
        <div className="result-badge">
          <span className="count">{item.classes}</span>
          <span className="label">classes</span>
        </div>
        <div className="result-badge">
          <span className="count">{item.textMatches}</span>
          <span className="label">text</span>
        </div>
      </div>
      <button className="btn-icon btn-remove" title="Remove" onClick={() => onRemove(item.id)}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}
