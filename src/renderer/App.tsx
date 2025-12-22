/**
 * My Dashboards - Main App Component
 */

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';
import { DashboardProvider } from './context/DashboardContext';
import { DashboardSidebar } from './components/dashboard/DashboardSidebar';
import { DashboardView } from './components/dashboard/DashboardView';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Load app version
  useEffect(() => {
    window.api.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setAppVersion(result.data);
      }
    });
  }, []);

  // Listen for auto-update events
  useEffect(() => {
    window.api.app.onUpdateAvailable((version) => {
      toast.info(`Update v${version} available, downloading...`);
    });

    window.api.app.onUpdateDownloaded((version) => {
      toast.success(`Update v${version} ready!`, {
        duration: Infinity,
        action: {
          label: 'Restart Now',
          onClick: () => window.api.app.quitAndInstall(),
        },
      });
    });

    return () => {
      window.api.app.removeUpdateListeners();
    };
  }, []);

  return (
    <DashboardProvider>
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <div className="app-logo">
              <h1 className="app-title">My Dashboards</h1>
            </div>
          </div>
          <div className="header-right">
            <span className="version-badge">v{appVersion}</span>
            <button onClick={() => setShowSettings(true)} className="settings-button">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main">
          <DashboardSidebar />
          <DashboardView />
        </main>

        {/* Settings Modal */}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

        {/* Toast notifications */}
        <Toaster position="bottom-right" richColors />
      </div>
    </DashboardProvider>
  );
}
