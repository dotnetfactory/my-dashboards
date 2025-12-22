import { useEffect, useRef, useCallback } from 'react';
import type { Widget } from '../../types/dashboard';

interface UseAutoRefreshReturn {
  triggerRefresh: () => void;
}

export function useAutoRefresh(
  widget: Widget,
  onRefresh: () => void
): UseAutoRefreshReturn {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if refresh is enabled
    if (widget.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        onRefresh();
      }, widget.refreshInterval * 1000);
    }

    // Cleanup on unmount or when interval changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [widget.refreshInterval, onRefresh]);

  return { triggerRefresh };
}
