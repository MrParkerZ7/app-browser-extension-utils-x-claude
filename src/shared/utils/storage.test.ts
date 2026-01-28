import { getStorageValue, setStorageValue, getStorageValues, setStorageValues } from './storage';
import { resetChromeMocks, setMockStorage } from '../../test/setup';

describe('storage utilities', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe('getStorageValue', () => {
    it('should retrieve a value from storage', async () => {
      setMockStorage({ testKey: 'testValue' });

      const result = await getStorageValue<string>('testKey');
      expect(result).toBe('testValue');
    });

    it('should return undefined for non-existent key', async () => {
      const result = await getStorageValue<string>('nonExistent');
      expect(result).toBeUndefined();
    });

    it('should handle different value types', async () => {
      setMockStorage({
        stringVal: 'hello',
        numberVal: 42,
        boolVal: true,
        objVal: { nested: 'value' },
        arrVal: [1, 2, 3],
      });

      expect(await getStorageValue<string>('stringVal')).toBe('hello');
      expect(await getStorageValue<number>('numberVal')).toBe(42);
      expect(await getStorageValue<boolean>('boolVal')).toBe(true);
      expect(await getStorageValue<object>('objVal')).toEqual({ nested: 'value' });
      expect(await getStorageValue<number[]>('arrVal')).toEqual([1, 2, 3]);
    });
  });

  describe('setStorageValue', () => {
    it('should set a value in storage', async () => {
      await setStorageValue('newKey', 'newValue');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ newKey: 'newValue' });
    });

    it('should handle different value types', async () => {
      await setStorageValue('strKey', 'string');
      await setStorageValue('numKey', 123);
      await setStorageValue('objKey', { test: true });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ strKey: 'string' });
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ numKey: 123 });
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ objKey: { test: true } });
    });
  });

  describe('getStorageValues', () => {
    it('should retrieve multiple values from storage', async () => {
      setMockStorage({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });

      const result = await getStorageValues<{ key1: string; key2: string }>(['key1', 'key2']);

      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should return partial results for missing keys', async () => {
      setMockStorage({ key1: 'value1' });

      const result = await getStorageValues<{ key1: string; key2: string }>(['key1', 'key2']);

      expect(result).toEqual({ key1: 'value1' });
      expect(result.key2).toBeUndefined();
    });

    it('should return empty object when no keys match', async () => {
      const result = await getStorageValues<Record<string, unknown>>(['nonExistent']);
      expect(result).toEqual({});
    });
  });

  describe('setStorageValues', () => {
    it('should set multiple values in storage', async () => {
      const values = { key1: 'value1', key2: 'value2' };

      await setStorageValues(values);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(values);
    });

    it('should handle empty object', async () => {
      await setStorageValues({});

      expect(chrome.storage.local.set).toHaveBeenCalledWith({});
    });
  });
});
