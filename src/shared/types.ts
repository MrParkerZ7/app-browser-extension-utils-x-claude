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

// FB Notification Listener types
export interface FBNotificationFilter {
  mentionsName: boolean;
  replyNotifications: boolean;
  allCommentNotifications: boolean;
}

export interface FBNotificationListenerConfig {
  enabled: boolean;
  intervalSeconds: number;
  filters: FBNotificationFilter;
  autoStartReply: boolean;
  expandPreviousNotifications: boolean;
  markAllAsRead: boolean;
}

export interface FBNotificationListenerState {
  running: boolean;
  lastCheck: number | null;
  nextCheck: number | null;
  notificationsFound: number;
  tabsOpened: number;
  error?: string;
}

export interface FBNotificationItem {
  id: string;
  text: string;
  url: string;
  timestamp?: number;
  matchType: 'mention' | 'reply' | 'comment';
}

export interface FBNotificationScanResult {
  success: boolean;
  notifications: FBNotificationItem[];
  error?: string;
}

export type FBTabStatus = 'pending' | 'processing' | 'done' | 'error';

// FB Auto Reply mode
export type FBAutoReplyMode = 'tabs' | 'bookmarks';

// Template selection mode
export type FBTemplateSelectionMode = 'random' | 'sequential' | 'shuffled';

export interface BookmarkFolder {
  id: string;
  title: string;
  path: string; // e.g., "Bookmarks Bar / Facebook"
}

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
  uploadImages: boolean;
  submitReply: boolean;
}

export interface FBReplyTemplate {
  message: string;
  imageUrls: string[];
}

export interface FBAutoReplyConfig {
  templates: FBReplyTemplate[];
  delayMin: number;
  delayMax: number;
  steps: FBReplySteps;
  doClose: boolean;
  mode: FBAutoReplyMode;
  bookmarkFolderId?: string;
  templateMode: FBTemplateSelectionMode;
}

export interface FBAutoReplyState {
  running: boolean;
  tabs: FBTab[];
  completed: number;
  total: number;
  currentTabId?: number;
  mode: FBAutoReplyMode;
  skippedBookmarks: number;
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
  | { type: 'FB_AUTO_REPLY'; payload: { template: FBReplyTemplate; steps: FBReplySteps } }
  | { type: 'FB_AUTO_REPLY_RESULT'; payload: FBReplyResult }
  // FB Auto Reply background service messages
  | { type: 'FB_SCAN_TABS'; payload?: undefined }
  | { type: 'FB_START_AUTO_REPLY'; payload: FBAutoReplyConfig }
  | { type: 'FB_STOP_AUTO_REPLY'; payload?: undefined }
  | { type: 'FB_GET_STATE'; payload?: undefined }
  | { type: 'FB_STATE_UPDATE'; payload: FBAutoReplyState }
  | { type: 'FB_SELECT_TAB'; payload: { tabId: number; selected: boolean } }
  | { type: 'FB_SELECT_ALL_TABS'; payload: { selected: boolean } }
  // FB Notification Listener messages
  | { type: 'FB_NOTIF_START'; payload: FBNotificationListenerConfig }
  | { type: 'FB_NOTIF_STOP'; payload?: undefined }
  | { type: 'FB_NOTIF_CHECK_NOW'; payload?: undefined }
  | { type: 'FB_NOTIF_GET_STATE'; payload?: undefined }
  | { type: 'FB_NOTIF_STATE_UPDATE'; payload: FBNotificationListenerState }
  | { type: 'FB_NOTIF_SAVE_CONFIG'; payload: FBNotificationListenerConfig }
  | { type: 'FB_NOTIF_GET_CONFIG'; payload?: undefined }
  | {
      type: 'FB_NOTIF_SCAN_PAGE';
      payload: { filters: FBNotificationFilter; expandPrevious: boolean };
    }
  | { type: 'FB_NOTIF_SCAN_RESULT'; payload: FBNotificationScanResult }
  | { type: 'FB_GET_BOOKMARK_FOLDERS'; payload?: undefined }
  // IDM Video Listener messages
  | { type: 'IDM_START_LISTENER'; payload: IDMListenerConfig }
  | { type: 'IDM_STOP_LISTENER'; payload?: undefined }
  | { type: 'IDM_GET_STATE'; payload?: undefined }
  | { type: 'IDM_STATE_UPDATE'; payload: IDMListenerState }
  | { type: 'IDM_SAVE_CONFIG'; payload: IDMListenerConfig }
  | { type: 'IDM_GET_CONFIG'; payload?: undefined }
  | { type: 'IDM_SCAN_PAGE'; payload?: undefined }
  | { type: 'IDM_SCAN_RESULT'; payload: IDMScanResult }
  | { type: 'IDM_VIDEO_FOUND'; payload: IDMVideoLink }
  | { type: 'IDM_DOWNLOAD_VIDEO'; payload: { url: string; downloadPath: string } }
  | { type: 'IDM_CLEAR_VIDEOS'; payload?: undefined }
  // IDM content script specific messages
  | { type: 'IDM_START_OBSERVER'; payload?: undefined }
  | { type: 'IDM_STOP_OBSERVER'; payload?: undefined }
  // Image Listener messages
  | { type: 'IMAGE_START_LISTENER'; payload: ImageListenerConfig }
  | { type: 'IMAGE_STOP_LISTENER'; payload?: undefined }
  | { type: 'IMAGE_GET_STATE'; payload?: undefined }
  | { type: 'IMAGE_STATE_UPDATE'; payload: ImageListenerState }
  | { type: 'IMAGE_SAVE_CONFIG'; payload: ImageListenerConfig }
  | { type: 'IMAGE_GET_CONFIG'; payload?: undefined }
  | { type: 'IMAGE_FOUND'; payload: ImageLink }
  | { type: 'IMAGE_DOWNLOAD'; payload: { url: string; downloadPath: string } }
  | { type: 'IMAGE_CLEAR'; payload?: undefined }
  // Image content script specific messages
  | { type: 'IMAGE_START_OBSERVER'; payload?: undefined }
  | { type: 'IMAGE_STOP_OBSERVER'; payload?: undefined };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// IDM Video Listener types
export interface IDMListenerConfig {
  enabled: boolean;
  downloadPath: string;
  autoDownload: boolean;
  videoExtensions: string[];
}

export interface IDMVideoLink {
  id: string;
  url: string;
  title: string;
  type: string;
  timestamp: number;
  tabId?: number;
  tabUrl?: string;
  downloaded: boolean;
}

export interface IDMListenerState {
  running: boolean;
  videosFound: IDMVideoLink[];
  totalFound: number;
  totalDownloaded: number;
}

export interface IDMScanResult {
  success: boolean;
  videos: IDMVideoLink[];
  error?: string;
}

// Image Listener types
export interface ImageListenerConfig {
  enabled: boolean;
  downloadPath: string;
  autoDownload: boolean;
  imageExtensions: string[];
  minWidth: number;
  minHeight: number;
}

export interface ImageLink {
  id: string;
  url: string;
  title: string;
  type: string;
  timestamp: number;
  tabId?: number;
  tabUrl?: string;
  downloaded: boolean;
}

export interface ImageListenerState {
  running: boolean;
  imagesFound: ImageLink[];
  totalFound: number;
  totalDownloaded: number;
}

export interface ImageScanResult {
  success: boolean;
  images: ImageLink[];
  error?: string;
}
