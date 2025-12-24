/**
 * Preload script for My Dashboards
 *
 * Exposes the API to the renderer process via contextBridge.
 * This file runs in a sandboxed context with access to Node.js APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  CreateDashboardData,
  UpdateDashboardData,
  CreateWidgetData,
  UpdateWidgetData,
  WidgetPosition,
  SaveCredentialsData,
  PickerSelection,
  CreateCredentialGroupData,
  UpdateCredentialGroupData,
} from './types/dashboard';

// Settings API
const settingsAPI = {
  get: (key: string) => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAll: () => ipcRenderer.invoke('settings:getAll'),
};

// Dialog API
const dialogAPI = {
  showSaveDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
};

// Shell API
const shellAPI = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
};

// Database API
const databaseAPI = {
  getInfo: () => ipcRenderer.invoke('database:getInfo'),
  migrateToDocuments: () => ipcRenderer.invoke('database:migrateToDocuments'),
  showInFinder: () => ipcRenderer.invoke('database:showInFinder'),
  selectExisting: () => ipcRenderer.invoke('database:selectExisting'),
};

// App API
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update:available', (_, version) => callback(version));
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update:downloaded', (_, version) => callback(version));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.removeAllListeners('update:downloaded');
  },
};

// Dashboards API
const dashboardsAPI = {
  list: () => ipcRenderer.invoke('dashboards:list'),
  create: (data: CreateDashboardData) => ipcRenderer.invoke('dashboards:create', data),
  get: (id: string) => ipcRenderer.invoke('dashboards:get', id),
  update: (id: string, data: UpdateDashboardData) => ipcRenderer.invoke('dashboards:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('dashboards:delete', id),
};

// Screenshot capture request type
interface ScreenshotCaptureRequest {
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

// Widgets API
const widgetsAPI = {
  list: (dashboardId: string) => ipcRenderer.invoke('widgets:list', dashboardId),
  create: (data: CreateWidgetData) => ipcRenderer.invoke('widgets:create', data),
  get: (id: string) => ipcRenderer.invoke('widgets:get', id),
  update: (id: string, data: UpdateWidgetData) => ipcRenderer.invoke('widgets:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('widgets:delete', id),
  updatePositions: (positions: WidgetPosition[]) => ipcRenderer.invoke('widgets:updatePositions', positions),
  captureScreenshot: (request: ScreenshotCaptureRequest) => ipcRenderer.invoke('widget:captureScreenshot', request),
};

// Credentials API
const credentialsAPI = {
  save: (widgetId: string, credentials: SaveCredentialsData) =>
    ipcRenderer.invoke('credentials:save', widgetId, credentials),
  get: (widgetId: string) => ipcRenderer.invoke('credentials:get', widgetId),
  delete: (widgetId: string) => ipcRenderer.invoke('credentials:delete', widgetId),
  hasCredentials: (widgetId: string) => ipcRenderer.invoke('credentials:hasCredentials', widgetId),
};

// Widget Picker API
const widgetPickerAPI = {
  open: (url: string, partition?: string) => ipcRenderer.invoke('widgetPicker:open', url, partition),
  onSelectionComplete: (callback: (selection: PickerSelection) => void) => {
    ipcRenderer.on('widgetPicker:selectionComplete', (_, selection) => callback(selection));
  },
  removeSelectionListener: () => {
    ipcRenderer.removeAllListeners('widgetPicker:selectionComplete');
  },
};

// Credential Picker API
const credentialPickerAPI = {
  open: (url: string) => ipcRenderer.invoke('credentialPicker:open', url),
};

// Credential Groups API
const credentialGroupsAPI = {
  list: () => ipcRenderer.invoke('credentialGroups:list'),
  create: (data: CreateCredentialGroupData) => ipcRenderer.invoke('credentialGroups:create', data),
  get: (id: string) => ipcRenderer.invoke('credentialGroups:get', id),
  update: (id: string, data: UpdateCredentialGroupData) =>
    ipcRenderer.invoke('credentialGroups:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('credentialGroups:delete', id),
  getCredentials: (id: string) => ipcRenderer.invoke('credentialGroups:getCredentials', id),
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('api', {
  settings: settingsAPI,
  dialog: dialogAPI,
  shell: shellAPI,
  database: databaseAPI,
  app: appAPI,
  dashboards: dashboardsAPI,
  widgets: widgetsAPI,
  credentials: credentialsAPI,
  credentialGroups: credentialGroupsAPI,
  widgetPicker: widgetPickerAPI,
  credentialPicker: credentialPickerAPI,
});
