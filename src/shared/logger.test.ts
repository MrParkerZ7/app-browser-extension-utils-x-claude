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

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[POPUP]',
        'Debug message',
        { extra: 'data' }
      );
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
