import Database from 'better-sqlite3';

/**
 * My Dashboards Database Schema
 *
 * Tables:
 * - settings: Application settings key-value store
 * - dashboards: User-created dashboards
 * - widgets: Web snippet widgets within dashboards
 * - widget_credentials: Encrypted login credentials for widgets (per-widget)
 * - credential_groups: Shared credential groups for multiple widgets
 */

export function initializeDatabase(db: Database.Database): void {
  console.log('Initializing database schema...');

  // Create settings table
  createSettingsTable(db);

  // Create dashboard tables
  createDashboardsTable(db);
  createWidgetsTable(db);
  createWidgetCredentialsTable(db);
  createCredentialGroupsTable(db);

  // Run migrations
  runMigrations(db);

  console.log('Database schema initialization complete');
}

function createSettingsTable(db: Database.Database): void {
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='settings'
  `).get();

  if (!tableExists) {
    console.log('Creating settings table...');
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('settings table created successfully');
  }
}

function createDashboardsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='dashboards'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating dashboards table...');
    db.exec(`
      CREATE TABLE dashboards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grid_columns INTEGER NOT NULL DEFAULT 12,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('dashboards table created successfully');
  }
}

function createWidgetsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='widgets'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating widgets table...');
    db.exec(`
      CREATE TABLE widgets (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,

        -- Selector configuration: 'css' or 'crop'
        selector_type TEXT NOT NULL CHECK(selector_type IN ('css', 'crop')),
        -- JSON: {selector: string} for css, {x, y, width, height, scrollX, scrollY} for crop
        selector_data TEXT NOT NULL,

        -- Grid position (column and row based)
        grid_col INTEGER NOT NULL DEFAULT 0,
        grid_row INTEGER NOT NULL DEFAULT 0,
        grid_col_span INTEGER NOT NULL DEFAULT 4,
        grid_row_span INTEGER NOT NULL DEFAULT 3,

        -- Display settings
        refresh_interval INTEGER NOT NULL DEFAULT 300,
        zoom_level REAL NOT NULL DEFAULT 1.0,

        -- Session partition (unique per widget for isolated cookies/storage)
        partition TEXT NOT NULL,

        -- Auth configuration
        has_credentials INTEGER NOT NULL DEFAULT 0,

        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,

        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_widgets_dashboard_id ON widgets(dashboard_id);
    `);
    console.log('widgets table created successfully');
  }
}

function createWidgetCredentialsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='widget_credentials'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating widget_credentials table...');
    db.exec(`
      CREATE TABLE widget_credentials (
        widget_id TEXT PRIMARY KEY,
        -- Encrypted using Electron's safeStorage API
        encrypted_username BLOB,
        encrypted_password BLOB,
        -- Login form configuration
        login_url TEXT,
        username_selector TEXT,
        password_selector TEXT,
        submit_selector TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,

        FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
      );
    `);
    console.log('widget_credentials table created successfully');
  }
}

function createCredentialGroupsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='credential_groups'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating credential_groups table...');
    db.exec(`
      CREATE TABLE credential_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        -- Encrypted using Electron's safeStorage API
        encrypted_username BLOB,
        encrypted_password BLOB,
        -- Login form configuration
        login_url TEXT NOT NULL,
        username_selector TEXT NOT NULL,
        password_selector TEXT NOT NULL,
        submit_selector TEXT,
        -- Session partition (shared by all widgets using this group)
        partition TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('credential_groups table created successfully');
  }
}

function runMigrations(db: Database.Database): void {
  // Migration: Add credential_group_id column to widgets table
  const hasCredentialGroupId = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM pragma_table_info('widgets')
    WHERE name = 'credential_group_id'
  `
    )
    .get() as { count: number };

  if (hasCredentialGroupId.count === 0) {
    console.log('Running migration: Adding credential_group_id to widgets...');
    db.exec(`
      ALTER TABLE widgets ADD COLUMN credential_group_id TEXT
        REFERENCES credential_groups(id) ON DELETE SET NULL
    `);
    console.log('Migration complete: credential_group_id added to widgets');
  }
}
