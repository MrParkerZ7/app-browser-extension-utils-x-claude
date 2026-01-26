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

export type FBTabStatus = 'pending' | 'processing' | 'done' | 'error';

export interface FBTab {
  id: number;
  index: number;
  title: string;
  url: string;
  status: FBTabStatus;
  error?: string;
  selected: boolean;
}

export interface FBReplySteps {
  clickReply: boolean;
  inputText: boolean;
  submitReply: boolean;
}

export interface FBAutoReplyConfig {
  message: string;
  delayMin: number;
  delayMax: number;
  steps: FBReplySteps;
  doClose: boolean;
}

export interface FBAutoReplyState {
  running: boolean;
  tabs: FBTab[];
  completed: number;
  total: number;
  currentTabId?: number;
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
  | { type: 'FB_AUTO_REPLY'; payload: { message: string; steps: FBReplySteps } }
  | { type: 'FB_AUTO_REPLY_RESULT'; payload: FBReplyResult }
  // FB Auto Reply background service messages
  | { type: 'FB_SCAN_TABS'; payload?: undefined }
  | { type: 'FB_START_AUTO_REPLY'; payload: FBAutoReplyConfig }
  | { type: 'FB_STOP_AUTO_REPLY'; payload?: undefined }
  | { type: 'FB_GET_STATE'; payload?: undefined }
  | { type: 'FB_STATE_UPDATE'; payload: FBAutoReplyState }
  | { type: 'FB_SELECT_TAB'; payload: { tabId: number; selected: boolean } }
  | { type: 'FB_SELECT_ALL_TABS'; payload: { selected: boolean } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
