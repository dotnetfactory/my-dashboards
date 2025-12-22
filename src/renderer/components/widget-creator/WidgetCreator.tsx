import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Globe, MousePointer, Clock, Key, Check } from 'lucide-react';
import { useWidgets } from '../../hooks/useWidgets';
import type { SelectorType, SelectorData, SaveCredentialsData } from '../../../types/dashboard';

interface WidgetCreatorProps {
  onClose: () => void;
}

type Step = 'url' | 'selector' | 'settings' | 'auth';

export function WidgetCreator({ onClose }: WidgetCreatorProps): React.ReactElement {
  const { createWidget } = useWidgets();
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [selectorType, setSelectorType] = useState<SelectorType | null>(null);
  const [selectorData, setSelectorData] = useState<SelectorData | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentials, setCredentials] = useState<SaveCredentialsData>({
    username: '',
    password: '',
    loginUrl: '',
    usernameSelector: '',
    passwordSelector: '',
    submitSelector: '',
  });
  const [loading, setLoading] = useState(false);

  const handleOpenPicker = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const result = await window.api.widgetPicker.open(url);
      if (result.success && result.data) {
        setSelectorType(result.data.selectorType as SelectorType);
        setSelectorData(result.data.selectorData as SelectorData);
        setStep('settings');
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
      // Find the login URL - use the widget URL or the loginUrl if specified
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

  const handleCreate = async () => {
    if (!selectorType || !selectorData) return;

    setLoading(true);
    try {
      const widget = await createWidget({
        name: name || new URL(url).hostname,
        url,
        selectorType,
        selectorData,
        refreshInterval,
      });

      if (widget && hasCredentials && credentials.username) {
        await window.api.credentials.save(widget.id, credentials);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create widget:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeUrl = (input: string): string => {
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      return `https://${input}`;
    }
    return input;
  };

  const renderStep = () => {
    switch (step) {
      case 'url':
        return (
          <div className="creator-step">
            <div className="step-header">
              <Globe size={24} />
              <h3>Enter URL</h3>
              <p>Enter the URL of the page containing the content you want to display</p>
            </div>
            <div className="step-content">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://analytics.google.com/..."
                autoFocus
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Widget name (optional)"
              />
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  setUrl(normalizeUrl(url));
                  setStep('selector');
                }}
                disabled={!url}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 'selector':
        return (
          <div className="creator-step">
            <div className="step-header">
              <MousePointer size={24} />
              <h3>Select Content</h3>
              <p>Open the page and select the element or region you want to capture</p>
            </div>
            <div className="step-content selector-options">
              <button className="selector-btn" onClick={handleOpenPicker} disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner small"></div>
                    Opening...
                  </>
                ) : (
                  <>
                    <MousePointer size={20} />
                    Open Page & Select
                  </>
                )}
              </button>
              <p className="hint">
                You can select a specific element (CSS) or draw a crop region
              </p>
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={() => setStep('url')}>
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="creator-step">
            <div className="step-header">
              <Clock size={24} />
              <h3>Settings</h3>
              <p>Configure how often the widget should refresh</p>
            </div>
            <div className="step-content">
              <label>
                Auto-refresh interval
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
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hasCredentials}
                  onChange={(e) => setHasCredentials(e.target.checked)}
                />
                Configure auto-login credentials
              </label>
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={() => setStep('selector')}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                className="primary"
                onClick={() => (hasCredentials ? setStep('auth') : handleCreate())}
                disabled={loading}
              >
                {hasCredentials ? 'Next' : 'Create Widget'}
                {!hasCredentials && loading && <div className="spinner small"></div>}
                {hasCredentials && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        );

      case 'auth': {
        const hasSelectors = credentials.usernameSelector && credentials.passwordSelector;
        return (
          <div className="creator-step">
            <div className="step-header">
              <Key size={24} />
              <h3>Login Credentials</h3>
              <p>Configure auto-login for when the session expires</p>
            </div>
            <div className="step-content auth-form">
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
              <div className="selector-picker-section">
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
                      <Check size={20} />
                      Form Fields Selected
                    </>
                  ) : (
                    <>
                      <MousePointer size={20} />
                      Select Login Form Fields
                    </>
                  )}
                </button>
                <p className="hint">
                  Click to open the login page and select the username field, password field, and submit button
                </p>
              </div>
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={() => setStep('settings')}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                className="primary"
                onClick={handleCreate}
                disabled={loading || !credentials.username || !credentials.password || !hasSelectors}
              >
                Create Widget
                {loading && <div className="spinner small"></div>}
              </button>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="widget-creator-overlay">
      <div className="widget-creator">
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="creator-progress">
          <div className={`progress-step ${step === 'url' ? 'active' : ''}`}>1. URL</div>
          <div className={`progress-step ${step === 'selector' ? 'active' : ''}`}>2. Select</div>
          <div className={`progress-step ${step === 'settings' ? 'active' : ''}`}>3. Settings</div>
          {hasCredentials && (
            <div className={`progress-step ${step === 'auth' ? 'active' : ''}`}>4. Auth</div>
          )}
        </div>

        {renderStep()}
      </div>
    </div>
  );
}
