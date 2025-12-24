/**
 * Window API Types
 *
 * Type definitions for the window.api object exposed via preload.
 * Add your own API types following the pattern below.
 */

import type {
  Dashboard,
  Widget,
  CreateDashboardData,
  UpdateDashboardData,
  CreateWidgetData,
  UpdateWidgetData,
  WidgetPosition,
  SaveCredentialsData,
  WidgetCredentials,
  PickerSelection,
  CredentialGroup,
  CredentialGroupWithPassword,
  CreateCredentialGroupData,
  UpdateCredentialGroupData,
} from './dashboard';

export interface IPCError {
  message: string;
  code?: string;
}

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

/**
 * Settings API exposed to renderer process
 */
export interface SettingsAPI {
  get: (key: string) => Promise<IPCResponse<string | null>>;
  set: (key: string, value: string) => Promise<IPCResponse<void>>;
  getAll: () => Promise<IPCResponse<Record<string, string>>>;
}

/**
 * Dialog API for native dialogs
 */
export interface DialogAPI {
  showSaveDialog: (options?: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | undefined>;
  showOpenDialog: (options?: {
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) => Promise<string[] | undefined>;
}

/**
 * Shell API for external operations
 */
export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<void>;
}

/**
 * Database location info
 */
export interface DatabaseInfo {
  currentPath: string;
  isLegacyLocation: boolean;
  canMigrate: boolean;
  legacyPath: string;
  defaultPath: string;
}

/**
 * Database API for managing database location
 */
export interface DatabaseAPI {
  getInfo: () => Promise<IPCResponse<DatabaseInfo>>;
  migrateToDocuments: () => Promise<IPCResponse<{ oldPath: string; newPath: string }>>;
  showInFinder: () => Promise<IPCResponse<void>>;
  selectExisting: () => Promise<IPCResponse<{ newPath: string }>>;
}

/**
 * App API for application information
 */
export interface AppAPI {
  getVersion: () => Promise<IPCResponse<string>>;
  quitAndInstall: () => Promise<IPCResponse<void>>;
  onUpdateAvailable: (callback: (version: string) => void) => void;
  onUpdateDownloaded: (callback: (version: string) => void) => void;
  removeUpdateListeners: () => void;
}

/**
 * Dashboards API for managing dashboards
 */
export interface DashboardsAPI {
  list: () => Promise<IPCResponse<Dashboard[]>>;
  create: (data: CreateDashboardData) => Promise<IPCResponse<Dashboard>>;
  get: (id: string) => Promise<IPCResponse<Dashboard | null>>;
  update: (id: string, data: UpdateDashboardData) => Promise<IPCResponse<Dashboard>>;
  delete: (id: string) => Promise<IPCResponse<void>>;
}

/**
 * Screenshot capture request
 */
export interface ScreenshotCaptureRequest {
  url: string;
  partition: string;
  selectorType: 'css' | 'crop';
  selectorData: {
    selectors?: string[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scrollX?: number;
    scrollY?: number;
  };
  credentials?: {
    username: string;
    password: string;
    loginUrl: string;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
  };
}

/**
 * Widgets API for managing dashboard widgets
 */
export interface WidgetsAPI {
  list: (dashboardId: string) => Promise<IPCResponse<Widget[]>>;
  create: (data: CreateWidgetData) => Promise<IPCResponse<Widget>>;
  get: (id: string) => Promise<IPCResponse<Widget | null>>;
  update: (id: string, data: UpdateWidgetData) => Promise<IPCResponse<Widget>>;
  delete: (id: string) => Promise<IPCResponse<void>>;
  updatePositions: (positions: WidgetPosition[]) => Promise<IPCResponse<void>>;
  captureScreenshot: (request: ScreenshotCaptureRequest) => Promise<IPCResponse<string>>;
}

/**
 * Credentials API for managing widget authentication
 */
export interface CredentialsAPI {
  save: (widgetId: string, credentials: SaveCredentialsData) => Promise<IPCResponse<void>>;
  get: (widgetId: string) => Promise<IPCResponse<WidgetCredentials | null>>;
  delete: (widgetId: string) => Promise<IPCResponse<void>>;
  hasCredentials: (widgetId: string) => Promise<IPCResponse<boolean>>;
}

/**
 * Widget Picker API for element selection
 * @param partition - Optional partition to share session with the widget
 */
export interface WidgetPickerAPI {
  open: (url: string, partition?: string) => Promise<IPCResponse<PickerSelection | null>>;
  onSelectionComplete: (callback: (selection: PickerSelection) => void) => void;
  removeSelectionListener: () => void;
}

/**
 * Credential picker selection result
 */
export interface CredentialPickerSelection {
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

/**
 * Credential Picker API for login form field selection
 */
export interface CredentialPickerAPI {
  open: (url: string) => Promise<IPCResponse<CredentialPickerSelection | null>>;
}

/**
 * Credential Groups API for managing shared credentials
 */
export interface CredentialGroupsAPI {
  list: () => Promise<IPCResponse<CredentialGroup[]>>;
  create: (data: CreateCredentialGroupData) => Promise<IPCResponse<CredentialGroup>>;
  get: (id: string) => Promise<IPCResponse<CredentialGroup | null>>;
  update: (id: string, data: UpdateCredentialGroupData) => Promise<IPCResponse<CredentialGroup>>;
  delete: (id: string) => Promise<IPCResponse<void>>;
  getCredentials: (id: string) => Promise<IPCResponse<CredentialGroupWithPassword | null>>;
}

/**
 * Main window API interface
 */
export interface WindowAPI {
  settings: SettingsAPI;
  dialog: DialogAPI;
  shell: ShellAPI;
  database: DatabaseAPI;
  app: AppAPI;
  dashboards: DashboardsAPI;
  widgets: WidgetsAPI;
  credentials: CredentialsAPI;
  credentialGroups: CredentialGroupsAPI;
  widgetPicker: WidgetPickerAPI;
  credentialPicker: CredentialPickerAPI;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}
