/**
 * My Dashboards - Application Configuration
 *
 * This file contains all app-specific configuration that gets baked into the build.
 * It is committed to version control and shared across the team.
 *
 * For secrets (API keys, certificates), use environment variables or GitHub Secrets.
 */

export const config = {
  // ===========================================================================
  // APP IDENTITY
  // ===========================================================================

  /** App name shown in OS (menu bar, dock, task manager) */
  productName: 'My Dashboards',

  /** Binary/executable name (lowercase, hyphens) */
  executableName: 'my-dashboards',

  /** macOS bundle identifier (reverse domain notation) */
  appBundleId: 'com.emadibrahim.my-dashboards',

  /** macOS app category */
  appCategory: 'public.app-category.productivity',

  // ===========================================================================
  // DATA STORAGE
  // ===========================================================================

  /** Folder name in user's app data directory (~/Library/Application Support on macOS) */
  appDataFolder: 'MyDashboards',

  /** SQLite database filename */
  dbFilename: 'dashboards.db',

  // ===========================================================================
  // GITHUB (for releases & auto-updates)
  // ===========================================================================

  github: {
    /** GitHub username or organization */
    owner: 'dotnetfactory',

    /** Repository name */
    repo: 'my-dashboards',

    /** Set to true if repository is private (requires GH_TOKEN secret) */
    private: false,
  },

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  /** Enable auto-update checks on app startup */
  autoUpdateEnabled: true,

  // ===========================================================================
  // PACKAGE MAINTAINER (for Linux packages)
  // ===========================================================================

  maintainer: 'Emad Ibrahim <emad@emadibrahim.com>',
} as const;

/** Type for the config object */
export type AppConfig = typeof config;
