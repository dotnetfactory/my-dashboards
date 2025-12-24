/**
 * IPC Handlers for My Dashboards
 *
 * Registers all IPC handlers for the main process.
 */

import { ipcMain, dialog, shell, app, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getDatabase, closeDatabase, getCurrentDatabasePath } from '../database/connection';
import { getDatabaseInfo, migrateDatabase, getDefaultDatabasePath, saveDatabaseConfig } from '../database/config';
import type {
  DashboardRow,
  WidgetRow,
  WidgetCredentialsRow,
  CredentialGroupRow,
  CreateDashboardData,
  UpdateDashboardData,
  CreateWidgetData,
  UpdateWidgetData,
  WidgetPosition,
  SaveCredentialsData,
  CreateCredentialGroupData,
  UpdateCredentialGroupData,
} from '../types/dashboard';
import {
  dashboardFromRow as todashhboard,
  widgetFromRow as toWidget,
  credentialGroupFromRow as toCredentialGroup,
} from '../types/dashboard';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Register all IPC handlers
 */
export function registerIPCHandlers(): void {
  // ============= Settings =============

  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return { success: true, data: row?.value || null };
    } catch (error) {
      return { success: false, error: { code: 'GET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:set', async (_, key: string, value: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, value, now, now);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'SET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: { code: 'GET_ALL_SETTINGS_ERROR', message: String(error) } };
    }
  });

  // ============= Dialog =============

  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const result = await dialog.showSaveDialog({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      return result.canceled ? undefined : result.filePath;
    }
  );

  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_, options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => {
      const result = await dialog.showOpenDialog({
        filters: options?.filters,
        properties: options?.properties as ('openFile' | 'openDirectory' | 'multiSelections')[],
      });
      return result.canceled ? undefined : result.filePaths;
    }
  );

  // ============= Shell =============

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ============= Database Location =============

  ipcMain.handle('database:getInfo', async () => {
    try {
      const info = getDatabaseInfo();
      const currentPath = getCurrentDatabasePath();
      return {
        success: true,
        data: {
          ...info,
          currentPath: currentPath || info.currentPath,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_DB_INFO_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:migrateToDocuments', async () => {
    try {
      const info = getDatabaseInfo();
      const sourcePath = getCurrentDatabasePath() || info.currentPath;
      const destPath = getDefaultDatabasePath();

      if (sourcePath === destPath) {
        return {
          success: false,
          error: { code: 'ALREADY_IN_DOCUMENTS', message: 'Database is already in Documents folder' },
        };
      }

      // Close the current database connection
      closeDatabase();

      // Perform the migration
      const result = migrateDatabase(sourcePath, destPath);

      if (!result.success) {
        getDatabase(); // Re-open at old location
        return { success: false, error: { code: 'MIGRATION_FAILED', message: result.error } };
      }

      // Re-open the database at the new location
      getDatabase();

      return {
        success: true,
        data: { oldPath: sourcePath, newPath: destPath },
      };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'MIGRATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:showInFinder', async () => {
    const currentPath = getCurrentDatabasePath();
    if (currentPath) {
      shell.showItemInFolder(currentPath);
      return { success: true };
    }
    return { success: false, error: { code: 'NO_DB_PATH', message: 'Database path not available' } };
  });

  ipcMain.handle('database:selectExisting', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Database',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile'],
        message: 'Select an existing database file',
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: { code: 'CANCELLED', message: 'Selection cancelled' } };
      }

      const selectedPath = result.filePaths[0];

      // Close the current database connection
      closeDatabase();

      // Save the new path to config
      saveDatabaseConfig({ dbPath: selectedPath });

      // Re-open the database at the new location
      getDatabase();

      return { success: true, data: { newPath: selectedPath } };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'SELECT_ERROR', message: String(error) } };
    }
  });

  // ============= App =============

  ipcMain.handle('app:getVersion', () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('app:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
  });

  // ============= Dashboards =============

  ipcMain.handle('dashboards:list', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM dashboards ORDER BY updated_at DESC').all() as DashboardRow[];
      return { success: true, data: rows.map(todashhboard) };
    } catch (error) {
      return { success: false, error: { code: 'LIST_DASHBOARDS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('dashboards:create', async (_, data: CreateDashboardData) => {
    try {
      const db = getDatabase();
      const id = generateId();
      const now = Date.now();
      db.prepare(`
        INSERT INTO dashboards (id, name, grid_columns, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, data.name, data.gridColumns ?? 12, now, now);
      const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow;
      return { success: true, data: todashhboard(row) };
    } catch (error) {
      return { success: false, error: { code: 'CREATE_DASHBOARD_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('dashboards:get', async (_, id: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow | undefined;
      return { success: true, data: row ? todashhboard(row) : null };
    } catch (error) {
      return { success: false, error: { code: 'GET_DASHBOARD_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('dashboards:update', async (_, id: string, data: UpdateDashboardData) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      const updates: string[] = ['updated_at = ?'];
      const values: (string | number)[] = [now];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.gridColumns !== undefined) {
        updates.push('grid_columns = ?');
        values.push(data.gridColumns);
      }

      values.push(id);
      db.prepare(`UPDATE dashboards SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as DashboardRow;
      return { success: true, data: todashhboard(row) };
    } catch (error) {
      return { success: false, error: { code: 'UPDATE_DASHBOARD_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('dashboards:delete', async (_, id: string) => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_DASHBOARD_ERROR', message: String(error) } };
    }
  });

  // ============= Widgets =============

  ipcMain.handle('widgets:list', async (_, dashboardId: string) => {
    try {
      const db = getDatabase();
      const rows = db
        .prepare('SELECT * FROM widgets WHERE dashboard_id = ? ORDER BY grid_row, grid_col')
        .all(dashboardId) as WidgetRow[];
      return { success: true, data: rows.map(toWidget) };
    } catch (error) {
      return { success: false, error: { code: 'LIST_WIDGETS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('widgets:create', async (_, data: CreateWidgetData) => {
    try {
      const db = getDatabase();
      const id = generateId();
      const now = Date.now();

      // Determine partition priority:
      // 1. Credential group's partition (if specified)
      // 2. Pre-generated partition from picker (if provided)
      // 3. Generate new widget-specific partition
      let partition = data.partition || `widget-${id}`;
      let hasCredentials = 0;
      let credentialGroupId: string | null = null;

      if (data.credentialGroupId) {
        const group = db
          .prepare('SELECT partition FROM credential_groups WHERE id = ?')
          .get(data.credentialGroupId) as { partition: string } | undefined;
        if (group) {
          partition = group.partition;
          hasCredentials = 1;
          credentialGroupId = data.credentialGroupId;
        }
      }

      db.prepare(`
        INSERT INTO widgets (
          id, dashboard_id, name, url, selector_type, selector_data,
          grid_col, grid_row, grid_col_span, grid_row_span,
          refresh_interval, zoom_level, partition, has_credentials,
          credential_group_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.dashboardId,
        data.name,
        data.url,
        data.selectorType,
        JSON.stringify(data.selectorData),
        data.gridCol ?? 0,
        data.gridRow ?? 0,
        data.gridColSpan ?? 4,
        data.gridRowSpan ?? 3,
        data.refreshInterval ?? 300,
        data.zoomLevel ?? 1.0,
        partition,
        hasCredentials,
        credentialGroupId,
        now,
        now
      );

      const row = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id) as WidgetRow;
      return { success: true, data: toWidget(row) };
    } catch (error) {
      return { success: false, error: { code: 'CREATE_WIDGET_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('widgets:get', async (_, id: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id) as WidgetRow | undefined;
      return { success: true, data: row ? toWidget(row) : null };
    } catch (error) {
      return { success: false, error: { code: 'GET_WIDGET_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('widgets:update', async (_, id: string, data: UpdateWidgetData) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      const updates: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.url !== undefined) {
        updates.push('url = ?');
        values.push(data.url);
      }
      if (data.selectorType !== undefined) {
        updates.push('selector_type = ?');
        values.push(data.selectorType);
      }
      if (data.selectorData !== undefined) {
        updates.push('selector_data = ?');
        values.push(JSON.stringify(data.selectorData));
      }
      if (data.gridCol !== undefined) {
        updates.push('grid_col = ?');
        values.push(data.gridCol);
      }
      if (data.gridRow !== undefined) {
        updates.push('grid_row = ?');
        values.push(data.gridRow);
      }
      if (data.gridColSpan !== undefined) {
        updates.push('grid_col_span = ?');
        values.push(data.gridColSpan);
      }
      if (data.gridRowSpan !== undefined) {
        updates.push('grid_row_span = ?');
        values.push(data.gridRowSpan);
      }
      if (data.refreshInterval !== undefined) {
        updates.push('refresh_interval = ?');
        values.push(data.refreshInterval);
      }
      if (data.zoomLevel !== undefined) {
        updates.push('zoom_level = ?');
        values.push(data.zoomLevel);
      }

      // Handle credential group association
      if (data.credentialGroupId !== undefined) {
        if (data.credentialGroupId === null) {
          // Removing credential group - reset to widget-specific partition
          updates.push('credential_group_id = ?');
          values.push(null);
          updates.push('partition = ?');
          values.push(`widget-${id}`);
          updates.push('has_credentials = ?');
          values.push(0);
        } else {
          // Associating with credential group
          const group = db
            .prepare('SELECT partition FROM credential_groups WHERE id = ?')
            .get(data.credentialGroupId) as { partition: string } | undefined;
          if (group) {
            updates.push('credential_group_id = ?');
            values.push(data.credentialGroupId);
            updates.push('partition = ?');
            values.push(group.partition);
            updates.push('has_credentials = ?');
            values.push(1);
          }
        }
      }

      values.push(id);
      db.prepare(`UPDATE widgets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const row = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id) as WidgetRow;
      return { success: true, data: toWidget(row) };
    } catch (error) {
      return { success: false, error: { code: 'UPDATE_WIDGET_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('widgets:delete', async (_, id: string) => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM widgets WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_WIDGET_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('widgets:updatePositions', async (_, positions: WidgetPosition[]) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      const stmt = db.prepare(`
        UPDATE widgets SET grid_col = ?, grid_row = ?, grid_col_span = ?, grid_row_span = ?, updated_at = ?
        WHERE id = ?
      `);

      const updateMany = db.transaction((items: WidgetPosition[]) => {
        for (const pos of items) {
          stmt.run(pos.gridCol, pos.gridRow, pos.gridColSpan, pos.gridRowSpan, now, pos.id);
        }
      });

      updateMany(positions);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'UPDATE_POSITIONS_ERROR', message: String(error) } };
    }
  });

  // ============= Credentials =============

  ipcMain.handle('credentials:save', async (_, widgetId: string, credentials: SaveCredentialsData) => {
    try {
      const db = getDatabase();
      const now = Date.now();

      // Encrypt credentials using OS keychain
      const encryptedUsername = safeStorage.encryptString(credentials.username);
      const encryptedPassword = safeStorage.encryptString(credentials.password);

      db.prepare(`
        INSERT INTO widget_credentials (
          widget_id, encrypted_username, encrypted_password,
          login_url, username_selector, password_selector, submit_selector,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(widget_id) DO UPDATE SET
          encrypted_username = excluded.encrypted_username,
          encrypted_password = excluded.encrypted_password,
          login_url = excluded.login_url,
          username_selector = excluded.username_selector,
          password_selector = excluded.password_selector,
          submit_selector = excluded.submit_selector,
          updated_at = excluded.updated_at
      `).run(
        widgetId,
        encryptedUsername,
        encryptedPassword,
        credentials.loginUrl,
        credentials.usernameSelector,
        credentials.passwordSelector,
        credentials.submitSelector,
        now,
        now
      );

      // Update widget to indicate it has credentials
      db.prepare('UPDATE widgets SET has_credentials = 1, updated_at = ? WHERE id = ?').run(now, widgetId);

      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'SAVE_CREDENTIALS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentials:get', async (_, widgetId: string) => {
    try {
      const db = getDatabase();
      const row = db
        .prepare('SELECT * FROM widget_credentials WHERE widget_id = ?')
        .get(widgetId) as WidgetCredentialsRow | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      // Decrypt credentials
      const username = safeStorage.decryptString(row.encrypted_username);
      const password = safeStorage.decryptString(row.encrypted_password);

      return {
        success: true,
        data: {
          widgetId: row.widget_id,
          username,
          password,
          loginUrl: row.login_url,
          usernameSelector: row.username_selector,
          passwordSelector: row.password_selector,
          submitSelector: row.submit_selector,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_CREDENTIALS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentials:delete', async (_, widgetId: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare('DELETE FROM widget_credentials WHERE widget_id = ?').run(widgetId);
      db.prepare('UPDATE widgets SET has_credentials = 0, updated_at = ? WHERE id = ?').run(now, widgetId);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_CREDENTIALS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentials:hasCredentials', async (_, widgetId: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT has_credentials FROM widgets WHERE id = ?').get(widgetId) as
        | { has_credentials: number }
        | undefined;
      return { success: true, data: row?.has_credentials === 1 };
    } catch (error) {
      return { success: false, error: { code: 'HAS_CREDENTIALS_ERROR', message: String(error) } };
    }
  });

  // ============= Credential Groups =============

  ipcMain.handle('credentialGroups:list', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM credential_groups ORDER BY name').all() as CredentialGroupRow[];
      return {
        success: true,
        data: rows.map((row) => toCredentialGroup(row, safeStorage.decryptString(row.encrypted_username))),
      };
    } catch (error) {
      return { success: false, error: { code: 'LIST_CREDENTIAL_GROUPS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentialGroups:create', async (_, data: CreateCredentialGroupData) => {
    try {
      const db = getDatabase();
      const id = generateId();
      const now = Date.now();
      const partition = `credential-group-${id}`;

      const encryptedUsername = safeStorage.encryptString(data.username);
      const encryptedPassword = safeStorage.encryptString(data.password);

      db.prepare(`
        INSERT INTO credential_groups (
          id, name, encrypted_username, encrypted_password,
          login_url, username_selector, password_selector, submit_selector,
          partition, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        encryptedUsername,
        encryptedPassword,
        data.loginUrl,
        data.usernameSelector,
        data.passwordSelector,
        data.submitSelector || null,
        partition,
        now,
        now
      );

      const row = db.prepare('SELECT * FROM credential_groups WHERE id = ?').get(id) as CredentialGroupRow;
      return { success: true, data: toCredentialGroup(row, data.username) };
    } catch (error) {
      return { success: false, error: { code: 'CREATE_CREDENTIAL_GROUP_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentialGroups:get', async (_, id: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM credential_groups WHERE id = ?').get(id) as CredentialGroupRow | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      const username = safeStorage.decryptString(row.encrypted_username);
      return { success: true, data: toCredentialGroup(row, username) };
    } catch (error) {
      return { success: false, error: { code: 'GET_CREDENTIAL_GROUP_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentialGroups:update', async (_, id: string, data: UpdateCredentialGroupData) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      const updates: string[] = ['updated_at = ?'];
      const values: (string | number | Buffer | null)[] = [now];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.username !== undefined) {
        updates.push('encrypted_username = ?');
        values.push(safeStorage.encryptString(data.username));
      }
      if (data.password !== undefined) {
        updates.push('encrypted_password = ?');
        values.push(safeStorage.encryptString(data.password));
      }
      if (data.loginUrl !== undefined) {
        updates.push('login_url = ?');
        values.push(data.loginUrl);
      }
      if (data.usernameSelector !== undefined) {
        updates.push('username_selector = ?');
        values.push(data.usernameSelector);
      }
      if (data.passwordSelector !== undefined) {
        updates.push('password_selector = ?');
        values.push(data.passwordSelector);
      }
      if (data.submitSelector !== undefined) {
        updates.push('submit_selector = ?');
        values.push(data.submitSelector || null);
      }

      values.push(id);
      db.prepare(`UPDATE credential_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const row = db.prepare('SELECT * FROM credential_groups WHERE id = ?').get(id) as CredentialGroupRow;
      const username = safeStorage.decryptString(row.encrypted_username);
      return { success: true, data: toCredentialGroup(row, username) };
    } catch (error) {
      return { success: false, error: { code: 'UPDATE_CREDENTIAL_GROUP_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentialGroups:delete', async (_, id: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();

      // First, clear credential_group_id from any widgets using this group
      // and reset their partitions to widget-specific ones
      const widgetsUsingGroup = db
        .prepare('SELECT id FROM widgets WHERE credential_group_id = ?')
        .all(id) as { id: string }[];

      for (const widget of widgetsUsingGroup) {
        db.prepare(`
          UPDATE widgets SET
            credential_group_id = NULL,
            has_credentials = 0,
            partition = ?,
            updated_at = ?
          WHERE id = ?
        `).run(`widget-${widget.id}`, now, widget.id);
      }

      // Then delete the group
      db.prepare('DELETE FROM credential_groups WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_CREDENTIAL_GROUP_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('credentialGroups:getCredentials', async (_, id: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM credential_groups WHERE id = ?').get(id) as CredentialGroupRow | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      const username = safeStorage.decryptString(row.encrypted_username);
      const password = safeStorage.decryptString(row.encrypted_password);

      return {
        success: true,
        data: {
          ...toCredentialGroup(row, username),
          password,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_CREDENTIAL_GROUP_CREDENTIALS_ERROR', message: String(error) } };
    }
  });

  console.log('[IPC] All handlers registered');
}
