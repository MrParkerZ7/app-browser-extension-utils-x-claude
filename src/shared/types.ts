// Shared types for the extension

export type LogSource = 'background' | 'content' | 'popup';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  source: LogSource;
  level: LogLevel;
  message: string;
  data?: unknown;
  tabId?: number;
  url?: string;
}

export interface LogState {
  logs: LogEntry[];
  maxLogs: number;
}

// Message types for communication
export type MessageType =
  | { type: 'LOG_ENTRY'; payload: Omit<LogEntry, 'id'> }
  | { type: 'GET_LOGS'; payload?: undefined }
  | { type: 'CLEAR_LOGS'; payload?: undefined }
  | { type: 'LOGS_UPDATED'; payload: LogEntry[] }
  | { type: 'GET_DATA'; payload?: undefined };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
