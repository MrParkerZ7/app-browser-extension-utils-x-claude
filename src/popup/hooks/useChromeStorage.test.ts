import { renderHook, act, waitFor } from '@testing-library/react';
import { useChromeStorage, useChromeStorageMultiple } from './useChromeStorage';
import { resetChromeMocks, setMockStorage } from '../../test/setup';

describe('useChromeStorage', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should return initial value before loading', () => {
    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should load value from storage', async () => {
    setMockStorage({ testKey: 'storedValue' });

    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    await waitFor(() => {
      expect(result.current[0]).toBe('storedValue');
    });
  });

  it('should use default value when storage is empty', async () => {
    const { result } = renderHook(() => useChromeStorage('emptyKey', 'defaultValue'));

    await waitFor(() => {
      expect(result.current[0]).toBe('defaultValue');
    });
  });

  it('should update value and persist to storage', async () => {
    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    act(() => {
      result.current[1]('newValue');
    });

    expect(result.current[0]).toBe('newValue');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ testKey: 'newValue' });
  });

  it('should handle different value types', async () => {
    setMockStorage({ numKey: 42 });

    const { result } = renderHook(() => useChromeStorage<number>('numKey', 0));

    await waitFor(() => {
      expect(result.current[0]).toBe(42);
    });
  });

  it('should handle object values', async () => {
    const objValue = { name: 'test', count: 5 };
    setMockStorage({ objKey: objValue });

    const { result } = renderHook(() =>
      useChromeStorage<{ name: string; count: number }>('objKey', { name: '', count: 0 })
    );

    await waitFor(() => {
      expect(result.current[0]).toEqual(objValue);
    });
  });
});

describe('useChromeStorageMultiple', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should return initial values before loading', () => {
    const defaults = { key1: 'default1', key2: 'default2' };
    const { result } = renderHook(() =>
      useChromeStorageMultiple(['key1', 'key2'], defaults)
    );

    expect(result.current[0]).toEqual(defaults);
  });

  it('should load multiple values from storage', async () => {
    setMockStorage({ key1: 'stored1', key2: 'stored2' });

    const defaults = { key1: 'default1', key2: 'default2' };
    const { result } = renderHook(() =>
      useChromeStorageMultiple(['key1', 'key2'], defaults)
    );

    await waitFor(() => {
      expect(result.current[0]).toEqual({ key1: 'stored1', key2: 'stored2' });
    });
  });

  it('should use defaults for missing keys', async () => {
    setMockStorage({ key1: 'stored1' });

    const defaults = { key1: 'default1', key2: 'default2' };
    const { result } = renderHook(() =>
      useChromeStorageMultiple(['key1', 'key2'], defaults)
    );

    await waitFor(() => {
      expect(result.current[0].key1).toBe('stored1');
      expect(result.current[0].key2).toBe('default2');
    });
  });

  it('should update values via partial object', async () => {
    const defaults = { key1: 'default1', key2: 'default2' };
    const { result } = renderHook(() =>
      useChromeStorageMultiple(['key1', 'key2'], defaults)
    );

    act(() => {
      result.current[1]({ key1: 'newValue' });
    });

    expect(result.current[0].key1).toBe('newValue');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ key1: 'newValue' });
  });

  it('should preserve other values when updating one', async () => {
    const defaults = { key1: 'default1', key2: 'default2' };
    const { result } = renderHook(() =>
      useChromeStorageMultiple(['key1', 'key2'], defaults)
    );

    act(() => {
      result.current[1]({ key1: 'newValue' });
    });

    expect(result.current[0].key1).toBe('newValue');
    expect(result.current[0].key2).toBe('default2');
  });
});
