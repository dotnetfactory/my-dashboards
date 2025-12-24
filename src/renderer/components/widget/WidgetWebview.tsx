import React, { useEffect, useState, useCallback } from 'react';
import type { Widget, CssSelectorData, CropSelectorData, WidgetCredentials } from '../../../types/dashboard';

// Common interface for credentials from either source
interface LoginCredentials {
  username: string;
  password: string;
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

interface WidgetWebviewProps {
  widget: Widget;
  refreshKey: number;
}

export function WidgetWebview({ widget, refreshKey }: WidgetWebviewProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Capture screenshot from main process
  const captureScreenshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get credentials if needed
      let credentials: LoginCredentials | undefined;

      if (widget.hasCredentials) {
        if (widget.credentialGroupId) {
          const groupResult = await window.api.credentialGroups.getCredentials(widget.credentialGroupId);
          if (groupResult.success && groupResult.data) {
            credentials = {
              username: groupResult.data.username,
              password: groupResult.data.password,
              loginUrl: groupResult.data.loginUrl,
              usernameSelector: groupResult.data.usernameSelector,
              passwordSelector: groupResult.data.passwordSelector,
              submitSelector: groupResult.data.submitSelector,
            };
          }
        } else {
          const widgetResult = await window.api.credentials.get(widget.id);
          if (widgetResult.success && widgetResult.data) {
            const creds = widgetResult.data as WidgetCredentials;
            credentials = {
              username: creds.username,
              password: creds.password,
              loginUrl: creds.loginUrl,
              usernameSelector: creds.usernameSelector,
              passwordSelector: creds.passwordSelector,
              submitSelector: creds.submitSelector,
            };
          }
        }
      }

      // Build selector data for capture request
      let selectorData: {
        selectors?: string[];
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        scrollX?: number;
        scrollY?: number;
      };

      if (widget.selectorType === 'css') {
        const cssData = widget.selectorData as CssSelectorData;
        selectorData = { selectors: cssData.selectors };
      } else {
        const cropData = widget.selectorData as CropSelectorData;
        selectorData = {
          x: cropData.x,
          y: cropData.y,
          width: cropData.width,
          height: cropData.height,
          scrollX: cropData.scrollX,
          scrollY: cropData.scrollY,
        };
      }

      // Request screenshot from main process
      const result = await window.api.widgets.captureScreenshot({
        url: widget.url,
        partition: widget.partition,
        selectorType: widget.selectorType,
        selectorData,
        credentials,
      });

      if (result.success && result.data) {
        setScreenshotUrl(result.data);
        setLoading(false);
      } else {
        setError(result.error?.message || 'Failed to capture screenshot');
        setLoading(false);
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      setError('Failed to capture screenshot');
      setLoading(false);
    }
  // Stringify selectorData to compare by value, not reference
  // This prevents unnecessary re-captures when refreshWidgets() creates new object references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, widget.url, widget.partition, widget.selectorType, JSON.stringify(widget.selectorData), widget.hasCredentials, widget.credentialGroupId]);

  // Initial capture and refresh handling
  useEffect(() => {
    captureScreenshot();
  }, [captureScreenshot, refreshKey]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (widget.refreshInterval > 0) {
      const interval = setInterval(() => {
        captureScreenshot();
      }, widget.refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [widget.refreshInterval, captureScreenshot]);

  return (
    <div className="widget-webview-container">
      {loading && (
        <div className="widget-loading">
          <div className="spinner"></div>
          <span>Capturing...</span>
        </div>
      )}
      {error && (
        <div className="widget-error">
          <span>{error}</span>
          <button onClick={captureScreenshot}>Retry</button>
        </div>
      )}
      {screenshotUrl && (
        <img
          src={screenshotUrl}
          alt={widget.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );
}
