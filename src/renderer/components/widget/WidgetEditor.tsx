import React, { useState, useEffect } from 'react';
import { X, Clock, Key, MousePointer, Check, Globe, ZoomIn, ZoomOut } from 'lucide-react';
import { useWidgets } from '../../hooks/useWidgets';
import type { Widget, SaveCredentialsData, SelectorType, SelectorData } from '../../../types/dashboard';

interface WidgetEditorProps {
  widget: Widget;
  onClose: () => void;
}

export function WidgetEditor({ widget, onClose }: WidgetEditorProps): React.ReactElement {
  const { updateWidget } = useWidgets();
  const [name, setName] = useState(widget.name);
  const [url, setUrl] = useState(widget.url);
  const [selectorType, setSelectorType] = useState<SelectorType>(widget.selectorType);
  const [selectorData, setSelectorData] = useState<SelectorData>(widget.selectorData);
  const [hasNewSelection, setHasNewSelection] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(widget.refreshInterval);
  const [zoomLevel, setZoomLevel] = useState(widget.zoomLevel);
  const [hasCredentials, setHasCredentials] = useState(widget.hasCredentials);
  const [credentials, setCredentials] = useState<SaveCredentialsData>({
    username: '',
    password: '',
    loginUrl: '',
    usernameSelector: '',
    passwordSelector: '',
    submitSelector: '',
  });
  const [loading, setLoading] = useState(false);

  // Load existing credentials if widget has them
  useEffect(() => {
    if (widget.hasCredentials) {
      window.api.credentials.get(widget.id).then((result) => {
        if (result.success && result.data) {
          setCredentials({
            username: result.data.username,
            password: result.data.password,
            loginUrl: result.data.loginUrl,
            usernameSelector: result.data.usernameSelector,
            passwordSelector: result.data.passwordSelector,
            submitSelector: result.data.submitSelector,
          });
        }
      });
    }
  }, [widget.id, widget.hasCredentials]);

  const handleOpenPicker = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const result = await window.api.widgetPicker.open(url);
      if (result.success && result.data) {
        setSelectorType(result.data.selectorType as SelectorType);
        setSelectorData(result.data.selectorData as SelectorData);
        setHasNewSelection(true);
      }
    } catch (err) {
      console.error('Picker failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCredentialPicker = async () => {
    setLoading(true);
    try {
      const loginPageUrl = credentials.loginUrl || url;
      const result = await window.api.credentialPicker.open(loginPageUrl);
      if (result.success && result.data) {
        setCredentials({
          ...credentials,
          usernameSelector: result.data.usernameSelector,
          passwordSelector: result.data.passwordSelector,
          submitSelector: result.data.submitSelector,
        });
      }
    } catch (err) {
      console.error('Credential picker failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update widget settings
      const updateData: Parameters<typeof updateWidget>[1] = {
        name,
        refreshInterval,
        zoomLevel,
      };

      // Include URL if changed
      if (url !== widget.url) {
        updateData.url = url;
      }

      // Include selector data if changed
      if (hasNewSelection) {
        updateData.selectorType = selectorType;
        updateData.selectorData = selectorData;
      }

      await updateWidget(widget.id, updateData);

      // Handle credentials
      if (hasCredentials && credentials.username && credentials.usernameSelector) {
        await window.api.credentials.save(widget.id, credentials);
      } else if (!hasCredentials && widget.hasCredentials) {
        await window.api.credentials.delete(widget.id);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save widget:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasSelectors = credentials.usernameSelector && credentials.passwordSelector;

  return (
    <div className="widget-editor-overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="widget-editor">
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="editor-header">
          <h2>Edit Widget</h2>
        </div>

        <div className="editor-content">
          <div className="editor-section">
            <label>
              Widget Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Widget name"
              />
            </label>
          </div>

          <div className="editor-section">
            <label>
              <Globe size={16} />
              Widget URL
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="editor-section">
            <label>
              <MousePointer size={16} />
              Content Selection
            </label>
            <p className="hint" style={{ margin: '4px 0 8px', fontSize: '12px', color: '#666' }}>
              {selectorType === 'css'
                ? `Currently selecting ${(selectorData as { selectors: string[] })?.selectors?.length || 0} element(s)`
                : 'Currently using crop region'}
              {hasNewSelection && ' (modified)'}
            </p>
            <button
              className="selector-btn"
              onClick={handleOpenPicker}
              disabled={loading || !url}
            >
              {loading ? (
                <>
                  <div className="spinner small"></div>
                  Opening...
                </>
              ) : (
                <>
                  <MousePointer size={16} />
                  Re-select Content
                </>
              )}
            </button>
          </div>

          <div className="editor-section">
            <label>
              <Clock size={16} />
              Auto-refresh Interval
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value={0}>Manual only</option>
                <option value={60}>Every minute</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
                <option value={1800}>Every 30 minutes</option>
                <option value={3600}>Every hour</option>
              </select>
            </label>
          </div>

          <div className="editor-section">
            <label>
              <ZoomIn size={16} />
              Zoom Level
            </label>
            <div className="zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.1))}
                disabled={zoomLevel <= 0.25}
              >
                <ZoomOut size={16} />
              </button>
              <span className="zoom-value">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
                disabled={zoomLevel >= 2}
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          <div className="editor-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasCredentials}
                onChange={(e) => setHasCredentials(e.target.checked)}
              />
              <Key size={16} />
              Auto-login Credentials
            </label>

            {hasCredentials && (
              <div className="credentials-form">
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  placeholder="Username or email"
                />
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Password"
                />
                <input
                  type="text"
                  value={credentials.loginUrl}
                  onChange={(e) => setCredentials({ ...credentials, loginUrl: e.target.value })}
                  placeholder="Login page URL (leave empty to use widget URL)"
                />
                <button
                  className={`selector-btn ${hasSelectors ? 'selected' : ''}`}
                  onClick={handleOpenCredentialPicker}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner small"></div>
                      Opening...
                    </>
                  ) : hasSelectors ? (
                    <>
                      <Check size={16} />
                      Form Fields Selected
                    </>
                  ) : (
                    <>
                      <MousePointer size={16} />
                      Select Login Form Fields
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="editor-actions">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={handleSave}
            disabled={loading || (hasCredentials && (!credentials.username || !hasSelectors))}
          >
            Save Changes
            {loading && <div className="spinner small"></div>}
          </button>
        </div>
      </div>
    </div>
  );
}
