/**
 * My Dashboards - Type Definitions
 */

// Dashboard types
export interface Dashboard {
  id: string;
  name: string;
  gridColumns: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDashboardData {
  name: string;
  gridColumns?: number;
}

export interface UpdateDashboardData {
  name?: string;
  gridColumns?: number;
}

// Widget selector types
export type SelectorType = 'css' | 'crop';

export interface CssSelectorData {
  selectors: string[];
}

export interface CropSelectorData {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export type SelectorData = CssSelectorData | CropSelectorData;

// Widget types
export interface Widget {
  id: string;
  dashboardId: string;
  name: string;
  url: string;
  selectorType: SelectorType;
  selectorData: SelectorData;
  gridCol: number;
  gridRow: number;
  gridColSpan: number;
  gridRowSpan: number;
  refreshInterval: number;
  zoomLevel: number;
  partition: string;
  hasCredentials: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWidgetData {
  dashboardId: string;
  name: string;
  url: string;
  selectorType: SelectorType;
  selectorData: SelectorData;
  gridCol?: number;
  gridRow?: number;
  gridColSpan?: number;
  gridRowSpan?: number;
  refreshInterval?: number;
  zoomLevel?: number;
}

export interface UpdateWidgetData {
  name?: string;
  url?: string;
  selectorType?: SelectorType;
  selectorData?: SelectorData;
  gridCol?: number;
  gridRow?: number;
  gridColSpan?: number;
  gridRowSpan?: number;
  refreshInterval?: number;
  zoomLevel?: number;
}

export interface WidgetPosition {
  id: string;
  gridCol: number;
  gridRow: number;
  gridColSpan: number;
  gridRowSpan: number;
}

// Widget credentials types
export interface WidgetCredentials {
  widgetId: string;
  username: string;
  password: string;
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

export interface SaveCredentialsData {
  username: string;
  password: string;
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

// Widget picker types
export interface PickerSelection {
  url: string;
  selectorType: SelectorType;
  selectorData: SelectorData;
}

// Database row types (snake_case as stored in SQLite)
export interface DashboardRow {
  id: string;
  name: string;
  grid_columns: number;
  created_at: number;
  updated_at: number;
}

export interface WidgetRow {
  id: string;
  dashboard_id: string;
  name: string;
  url: string;
  selector_type: string;
  selector_data: string;
  grid_col: number;
  grid_row: number;
  grid_col_span: number;
  grid_row_span: number;
  refresh_interval: number;
  zoom_level: number;
  partition: string;
  has_credentials: number;
  created_at: number;
  updated_at: number;
}

export interface WidgetCredentialsRow {
  widget_id: string;
  encrypted_username: Buffer;
  encrypted_password: Buffer;
  login_url: string;
  username_selector: string;
  password_selector: string;
  submit_selector: string;
  created_at: number;
  updated_at: number;
}

// Utility functions to convert between row and model
export function dashboardFromRow(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    name: row.name,
    gridColumns: row.grid_columns,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function widgetFromRow(row: WidgetRow): Widget {
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    name: row.name,
    url: row.url,
    selectorType: row.selector_type as SelectorType,
    selectorData: JSON.parse(row.selector_data),
    gridCol: row.grid_col,
    gridRow: row.grid_row,
    gridColSpan: row.grid_col_span,
    gridRowSpan: row.grid_row_span,
    refreshInterval: row.refresh_interval,
    zoomLevel: row.zoom_level,
    partition: row.partition,
    hasCredentials: row.has_credentials === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
