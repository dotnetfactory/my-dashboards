import { useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import type { CreateWidgetData, UpdateWidgetData, WidgetPosition, Widget } from '../../types/dashboard';

interface UseWidgetsReturn {
  widgets: Widget[];
  createWidget: (data: Omit<CreateWidgetData, 'dashboardId'>) => Promise<Widget | null>;
  updateWidget: (id: string, data: UpdateWidgetData) => Promise<void>;
  deleteWidget: (id: string) => Promise<void>;
  updatePositions: (positions: WidgetPosition[]) => Promise<void>;
}

export function useWidgets(): UseWidgetsReturn {
  const { currentDashboard, widgets, refreshWidgets } = useDashboardContext();

  const createWidget = useCallback(
    async (data: Omit<CreateWidgetData, 'dashboardId'>): Promise<Widget | null> => {
      if (!currentDashboard) return null;

      try {
        const result = await window.api.widgets.create({
          ...data,
          dashboardId: currentDashboard.id,
        });
        if (result.success && result.data) {
          await refreshWidgets();
          return result.data;
        }
        console.error('Failed to create widget:', result.error);
        return null;
      } catch (err) {
        console.error('Failed to create widget:', err);
        return null;
      }
    },
    [currentDashboard, refreshWidgets]
  );

  const updateWidget = useCallback(
    async (id: string, data: UpdateWidgetData): Promise<void> => {
      try {
        const result = await window.api.widgets.update(id, data);
        if (result.success) {
          await refreshWidgets();
        } else {
          console.error('Failed to update widget:', result.error);
        }
      } catch (err) {
        console.error('Failed to update widget:', err);
      }
    },
    [refreshWidgets]
  );

  const deleteWidget = useCallback(
    async (id: string): Promise<void> => {
      try {
        const result = await window.api.widgets.delete(id);
        if (result.success) {
          await refreshWidgets();
        } else {
          console.error('Failed to delete widget:', result.error);
        }
      } catch (err) {
        console.error('Failed to delete widget:', err);
      }
    },
    [refreshWidgets]
  );

  const updatePositions = useCallback(
    async (positions: WidgetPosition[]): Promise<void> => {
      try {
        const result = await window.api.widgets.updatePositions(positions);
        if (!result.success) {
          console.error('Failed to update positions:', result.error);
        }
      } catch (err) {
        console.error('Failed to update positions:', err);
      }
    },
    []
  );

  return {
    widgets,
    createWidget,
    updateWidget,
    deleteWidget,
    updatePositions,
  };
}
