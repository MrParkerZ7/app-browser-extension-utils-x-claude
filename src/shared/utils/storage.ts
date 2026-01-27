// Chrome storage utility helpers

export async function getStorageValue<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function setStorageValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getStorageValues<T extends Record<string, unknown>>(
  keys: string[]
): Promise<Partial<T>> {
  return (await chrome.storage.local.get(keys)) as Partial<T>;
}

export async function setStorageValues(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values);
}
