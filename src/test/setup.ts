import '@testing-library/jest-dom';

// Mock Chrome APIs
const mockStorage: Record<string, unknown> = {};

const chromeMock = {
  runtime: {
    sendMessage: jest.fn().mockImplementation((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: 'mock-extension-id',
  },
  storage: {
    local: {
      get: jest.fn().mockImplementation((keys) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            if (mockStorage[key] !== undefined) {
              result[key] = mockStorage[key];
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(mockStorage);
      }),
      set: jest.fn().mockImplementation((items) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: jest.fn().mockImplementation((keys) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach((key) => delete mockStorage[key]);
        return Promise.resolve();
      }),
      clear: jest.fn().mockImplementation(() => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
        return Promise.resolve();
      }),
    },
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  scripting: {
    executeScript: jest.fn().mockResolvedValue([]),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  windows: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    getCurrent: jest.fn().mockResolvedValue({ id: 1, type: 'popup' }),
  },
};

// Assign to global
(global as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// Helper to reset mocks between tests
export function resetChromeMocks() {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  jest.clearAllMocks();
}

// Helper to set mock storage values
export function setMockStorage(values: Record<string, unknown>) {
  Object.assign(mockStorage, values);
}
