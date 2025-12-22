import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Dashboard, Widget } from '../../types/dashboard';

interface DashboardContextType {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  widgets: Widget[];
  loading: boolean;
  error: string | null;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  createDashboard: (name: string) => Promise<Dashboard | null>;
  updateDashboard: (id: string, name: string) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  refreshDashboards: () => Promise<void>;
  refreshWidgets: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboardContext(): DashboardContextType {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps): React.ReactElement {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboards = useCallback(async () => {
    try {
      const result = await window.api.dashboards.list();
      if (result.success && result.data) {
        setDashboards(result.data);
        // Auto-select first dashboard if none selected
        if (!currentDashboard && result.data.length > 0) {
          setCurrentDashboard(result.data[0]);
        }
      } else {
        setError(result.error?.message || 'Failed to load dashboards');
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDashboard]);

  const refreshWidgets = useCallback(async () => {
    if (!currentDashboard) {
      setWidgets([]);
      return;
    }
    try {
      const result = await window.api.widgets.list(currentDashboard.id);
      if (result.success && result.data) {
        setWidgets(result.data);
      } else {
        setError(result.error?.message || 'Failed to load widgets');
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDashboard]);

  const createDashboard = useCallback(async (name: string): Promise<Dashboard | null> => {
    try {
      const result = await window.api.dashboards.create({ name });
      if (result.success && result.data) {
        await refreshDashboards();
        setCurrentDashboard(result.data);
        return result.data;
      }
      setError(result.error?.message || 'Failed to create dashboard');
      return null;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [refreshDashboards]);

  const updateDashboard = useCallback(async (id: string, name: string): Promise<void> => {
    try {
      const result = await window.api.dashboards.update(id, { name });
      if (result.success) {
        await refreshDashboards();
        if (currentDashboard?.id === id && result.data) {
          setCurrentDashboard(result.data);
        }
      } else {
        setError(result.error?.message || 'Failed to update dashboard');
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDashboard, refreshDashboards]);

  const deleteDashboard = useCallback(async (id: string): Promise<void> => {
    try {
      const result = await window.api.dashboards.delete(id);
      if (result.success) {
        if (currentDashboard?.id === id) {
          setCurrentDashboard(null);
        }
        await refreshDashboards();
      } else {
        setError(result.error?.message || 'Failed to delete dashboard');
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDashboard, refreshDashboards]);

  // Load dashboards on mount
  useEffect(() => {
    setLoading(true);
    refreshDashboards().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load widgets when dashboard changes
  useEffect(() => {
    refreshWidgets();
  }, [currentDashboard, refreshWidgets]);

  const value: DashboardContextType = {
    dashboards,
    currentDashboard,
    widgets,
    loading,
    error,
    setCurrentDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    refreshDashboards,
    refreshWidgets,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
