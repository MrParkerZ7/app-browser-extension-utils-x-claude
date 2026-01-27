// Centralized logger utility
import { LogSource, LogLevel, LogEntry, MessageResponse } from './types';

class Logger {
  private source: LogSource;
  private isBackground: boolean;

  constructor(source: LogSource) {
    this.source = source;
    this.isBackground = source === 'background';
  }

  private sendLog(level: LogLevel, message: string, data?: unknown): void {
    // Check if extension context is valid before doing anything
    if (!this.isBackground && (typeof chrome === 'undefined' || !chrome.runtime?.id)) {
      return;
    }

    const tabInfo = this.source === 'content' ? { url: window.location.href } : {};

    const logEntry: Omit<LogEntry, 'id'> = {
      timestamp: Date.now(),
      source: this.source,
      level,
      message,
      data,
      ...tabInfo,
    };

    // Also output to console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${this.source.toUpperCase()}]`, message, data ?? '');

    if (this.isBackground) {
      // Background handles logs directly via global function
      if (typeof (globalThis as any).__addLog === 'function') {
        (globalThis as any).__addLog(logEntry);
      }
    } else {
      // Send to background for storage
      this.safeSendMessage(logEntry);
    }
  }

  private safeSendMessage(logEntry: Omit<LogEntry, 'id'>): void {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        return;
      }
      chrome.runtime.sendMessage({ type: 'LOG_ENTRY', payload: logEntry }, () => {
        // Suppress any errors
        void chrome.runtime.lastError;
      });
    } catch {
      // Ignore all errors
    }
  }

  debug(message: string, data?: unknown): void {
    this.sendLog('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.sendLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.sendLog('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.sendLog('error', message, data);
  }
}

export function createLogger(source: LogSource): Logger {
  return new Logger(source);
}

// Utility to fetch logs from background
export async function getLogs(): Promise<LogEntry[]> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (response: MessageResponse<LogEntry[]>) => {
      if (response?.success && response.data) {
        resolve(response.data);
      } else {
        resolve([]);
      }
    });
  });
}

// Utility to clear logs
export async function clearLogs(): Promise<void> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' }, () => {
      resolve();
    });
  });
}
