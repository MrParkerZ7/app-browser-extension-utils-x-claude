import { useState, useEffect, useCallback } from 'react';

export function useChromeStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    chrome.storage.local.get([key]).then(result => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
    });
  }, [key]);

  const setStoredValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      chrome.storage.local.set({ [key]: newValue });
    },
    [key]
  );

  return [value, setStoredValue];
}

export function useChromeStorageMultiple<T extends Record<string, unknown>>(
  keys: (keyof T)[],
  defaults: T
): [T, (updates: Partial<T>) => void] {
  const [values, setValues] = useState<T>(defaults);

  useEffect(() => {
    chrome.storage.local.get(keys as string[]).then(result => {
      const newValues = { ...defaults };
      for (const key of keys) {
        if (result[key as string] !== undefined) {
          newValues[key] = result[key as string];
        }
      }
      setValues(newValues);
    });
  }, []);

  const setStoredValues = useCallback((updates: Partial<T>) => {
    setValues(prev => {
      const newValues = { ...prev, ...updates };
      chrome.storage.local.set(updates);
      return newValues;
    });
  }, []);

  return [values, setStoredValues];
}
