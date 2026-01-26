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

// HTML Counter result from content script
export interface CSSSearchResult {
  query: string;
  classes: number;
  textMatches: number;
}

// FB Auto Reply types
export interface FBReplyResult {
  success: boolean;
  error?: string;
}

// Message types for communication
export type MessageType =
  | { type: 'LOG_ENTRY'; payload: Omit<LogEntry, 'id'> }
  | { type: 'GET_LOGS'; payload?: undefined }
  | { type: 'CLEAR_LOGS'; payload?: undefined }
  | { type: 'LOGS_UPDATED'; payload: LogEntry[] }
  | { type: 'GET_DATA'; payload?: undefined }
  | { type: 'CSS_SEARCH'; payload: { query: string } }
  | { type: 'CSS_SEARCH_RESULT'; payload: CSSSearchResult }
  | { type: 'FB_AUTO_REPLY'; payload: { message: string } }
  | { type: 'FB_AUTO_REPLY_RESULT'; payload: FBReplyResult };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
