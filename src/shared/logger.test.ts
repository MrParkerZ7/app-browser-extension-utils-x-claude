import { createLogger, getLogs, clearLogs } from './logger';
import { resetChromeMocks } from '../test/setup';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    resetChromeMocks();
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('createLogger', () => {
    it('should create a logger with the specified source', () => {
      const logger = createLogger('popup');
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('logging methods', () => {
    it('should log debug messages to console', () => {
      const logger = createLogger('popup');
      logger.debug('Debug message', { extra: 'data' });

      expect(consoleSpy.log).toHaveBeenCalledWith('[POPUP]', 'Debug message', { extra: 'data' });
    });

    it('should log info messages to console', () => {
      const logger = createLogger('popup');
      logger.info('Info message');

      expect(consoleSpy.log).toHaveBeenCalledWith('[POPUP]', 'Info message', '');
    });

    it('should log warn messages to console.warn', () => {
      const logger = createLogger('popup');
      logger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith('[POPUP]', 'Warning message', '');
    });

    it('should log error messages to console.error', () => {
      const logger = createLogger('popup');
      logger.error('Error message');

      expect(consoleSpy.error).toHaveBeenCalledWith('[POPUP]', 'Error message', '');
    });

    it('should include data in log output when provided', () => {
      const logger = createLogger('popup');
      const data = { userId: 123, action: 'click' };
      logger.info('User action', data);

      expect(consoleSpy.log).toHaveBeenCalledWith('[POPUP]', 'User action', data);
    });

    it('should send log entry to background for non-background sources', () => {
      const logger = createLogger('popup');
      logger.info('Test message');

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOG_ENTRY',
          payload: expect.objectContaining({
            source: 'popup',
            level: 'info',
            message: 'Test message',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should use uppercase source in console output', () => {
      const logger = createLogger('content');
      logger.debug('Test');

      expect(consoleSpy.log).toHaveBeenCalledWith('[CONTENT]', 'Test', '');
    });
  });

  describe('background logger', () => {
    it('should call __addLog for background source when available', () => {
      const mockAddLog = jest.fn();
      (globalThis as any).__addLog = mockAddLog;

      const logger = createLogger('background');
      logger.info('Background message');

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'background',
          level: 'info',
          message: 'Background message',
        })
      );

      delete (globalThis as any).__addLog;
    });

    it('should not send message to runtime for background source', () => {
      const logger = createLogger('background');
      logger.info('Background message');

      // Should not call sendMessage for background
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'LOG_ENTRY' }),
        expect.any(Function)
      );
    });
  });

  describe('invalid chrome context', () => {
    it('should return early in sendLog when chrome.runtime.id is undefined', () => {
      // Save original
      const originalId = chrome.runtime.id;
      // Simulate invalid extension context
      Object.defineProperty(chrome.runtime, 'id', {
        value: undefined,
        configurable: true,
      });

      const logger = createLogger('popup');
      logger.info('Test message');

      // Should not call sendMessage when context is invalid
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      // Should not log to console either (early return before console.log)
      expect(consoleSpy.log).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(chrome.runtime, 'id', {
        value: originalId,
        configurable: true,
      });
    });

    it('should return early in safeSendMessage when chrome.runtime.id becomes undefined', () => {
      // Create logger with valid context first
      const logger = createLogger('popup');

      // Track access count to change behavior between sendLog check and safeSendMessage check
      let idAccessCount = 0;
      const originalId = chrome.runtime.id;
      const originalSendMessage = chrome.runtime.sendMessage;

      // Create a runtime object where id changes on subsequent accesses
      // The check happens at: line 15 (sendLog), line 47 (safeSendMessage)
      // We need id to be valid at line 15 but undefined at line 47
      Object.defineProperty(chrome.runtime, 'id', {
        get() {
          idAccessCount++;
          // Line 15 check is first access - return valid id
          // Line 47 check is second access - return undefined
          return idAccessCount === 1 ? originalId : undefined;
        },
        configurable: true,
      });

      logger.info('Test message');

      // Should not call sendMessage since we return early in safeSendMessage
      expect(originalSendMessage).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(chrome.runtime, 'id', {
        value: originalId,
        configurable: true,
      });
    });

    it('should handle case when chrome is undefined for non-background logger', () => {
      // Save original chrome
      const originalChrome = globalThis.chrome;

      // Create logger before removing chrome
      const logger = createLogger('content');

      // Remove chrome to simulate extension context invalidation
      (globalThis as any).chrome = undefined;

      // This should not throw
      expect(() => logger.info('Test')).not.toThrow();

      // Restore chrome
      (globalThis as any).chrome = originalChrome;
    });

    it('should catch errors thrown during sendMessage', () => {
      const logger = createLogger('popup');

      // Make sendMessage throw an error
      (chrome.runtime.sendMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      // This should not throw - error is caught
      expect(() => logger.info('Test message')).not.toThrow();
    });
  });
});

describe('getLogs', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should request logs from background', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      if (message.type === 'GET_LOGS') {
        callback({ success: true, data: [{ id: '1', message: 'test' }] });
      }
    });

    const logs = await getLogs();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_LOGS' },
      expect.any(Function)
    );
    expect(logs).toEqual([{ id: '1', message: 'test' }]);
  });

  it('should return empty array on failure', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      if (message.type === 'GET_LOGS') {
        callback({ success: false });
      }
    });

    const logs = await getLogs();
    expect(logs).toEqual([]);
  });
});

describe('clearLogs', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should send clear logs message to background', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      if (message.type === 'CLEAR_LOGS') {
        callback();
      }
    });

    await clearLogs();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'CLEAR_LOGS' },
      expect.any(Function)
    );
  });
});
