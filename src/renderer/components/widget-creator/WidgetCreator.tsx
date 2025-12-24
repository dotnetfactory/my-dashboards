import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Globe, MousePointer, Clock, Key, Check, Plus } from 'lucide-react';
import { useWidgets } from '../../hooks/useWidgets';
import { useCredentialGroups } from '../../hooks/useCredentialGroups';
import { CredentialGroupCreator } from '../credential-groups/CredentialGroupCreator';
import type {
  SelectorType,
  SelectorData,
  SaveCredentialsData,
  CreateCredentialGroupData,
} from '../../../types/dashboard';

// Global session partition - shared by all widgets that opt into it
const GLOBAL_SESSION_PARTITION = 'global-session';

interface WidgetCreatorProps {
  onClose: () => void;
}

type Step = 'url' | 'selector' | 'settings' | 'auth';
type AuthMode = 'credential-group' | 'per-widget' | 'none';
type SessionMode = 'global' | 'isolated';

export function WidgetCreator({ onClose }: WidgetCreatorProps): React.ReactElement {
  const { createWidget } = useWidgets();
  const { groups, createGroup } = useCredentialGroups();
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [selectorType, setSelectorType] = useState<SelectorType | null>(null);
  const [selectorData, setSelectorData] = useState<SelectorData | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [hasCredentials, setHasCredentials] = useState(false);

  // Session mode - global shares session across widgets, isolated is unique per widget
  const [sessionMode, setSessionMode] = useState<SessionMode>('global');

  // Auth mode state
  const [authMode, setAuthMode] = useState<AuthMode>('credential-group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [showGroupCreator, setShowGroupCreator] = useState(false);

  // Per-widget credentials (legacy mode)
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
      // Use global session partition so login during picker is preserved
      const partition = sessionMode === 'global' ? GLOBAL_SESSION_PARTITION : undefined;
      const result = await window.api.widgetPicker.open(url, partition);
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

  const handleCreateCredentialGroup = async (data: CreateCredentialGroupData) => {
    const group = await createGroup(data);
    if (group) {
      setSelectedGroupId(group.id);
      setShowGroupCreator(false);
    }
  };

  const handleCreate = async () => {
    if (!selectorType || !selectorData) return;

    setLoading(true);
    try {
      // Determine credential group ID based on auth mode
      const credentialGroupId = authMode === 'credential-group' && selectedGroupId ? selectedGroupId : undefined;

      // Use global session partition if selected (unless using credential group which has its own)
      const partition = !credentialGroupId && sessionMode === 'global' ? GLOBAL_SESSION_PARTITION : undefined;

      const widget = await createWidget({
        name: name || new URL(url).hostname,
        url,
        selectorType,
        selectorData,
        refreshInterval,
        credentialGroupId,
        partition,
      });

      // Only save per-widget credentials if using legacy mode
      if (widget && authMode === 'per-widget' && credentials.username) {
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

  // If showing the credential group creator, render it instead
  if (showGroupCreator) {
    return (
      <CredentialGroupCreator
        onClose={() => setShowGroupCreator(false)}
        onCreate={handleCreateCredentialGroup}
        defaultLoginUrl={url}
      />
    );
  }

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
            <div className="step-content">
              <div className="session-mode-selector">
                <label className="session-option">
                  <input
                    type="radio"
                    name="sessionMode"
                    value="global"
                    checked={sessionMode === 'global'}
                    onChange={() => setSessionMode('global')}
                  />
                  <div className="session-option-content">
                    <strong>Shared Session</strong>
                    <p>Share login with other widgets (recommended)</p>
                  </div>
                </label>
                <label className="session-option">
                  <input
                    type="radio"
                    name="sessionMode"
                    value="isolated"
                    checked={sessionMode === 'isolated'}
                    onChange={() => setSessionMode('isolated')}
                  />
                  <div className="session-option-content">
                    <strong>Isolated Session</strong>
                    <p>Separate login for this widget only</p>
                  </div>
                </label>
              </div>
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
        const canCreate =
          authMode === 'credential-group'
            ? !!selectedGroupId
            : credentials.username && credentials.password && hasSelectors;

        return (
          <div className="creator-step">
            <div className="step-header">
              <Key size={24} />
              <h3>Authentication</h3>
              <p>Configure how this widget will authenticate</p>
            </div>
            <div className="step-content">
              <div className="auth-options">
                {/* Credential Group Option */}
                <label className="auth-option">
                  <input
                    type="radio"
                    name="authMode"
                    value="credential-group"
                    checked={authMode === 'credential-group'}
                    onChange={() => setAuthMode('credential-group')}
                  />
                  <div className="auth-option-content">
                    <strong>Use Credential Group (Recommended)</strong>
                    <p>Share credentials and session with other widgets</p>
                  </div>
                </label>

                {authMode === 'credential-group' && (
                  <div className="credential-group-selector">
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      <option value="">Select a credential group...</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.username})
                        </option>
                      ))}
                    </select>
                    <button
                      className="create-new-btn"
                      onClick={() => setShowGroupCreator(true)}
                    >
                      <Plus size={14} />
                      Create New Credential Group
                    </button>
                  </div>
                )}

                {/* Per-Widget Option */}
                <label className="auth-option">
                  <input
                    type="radio"
                    name="authMode"
                    value="per-widget"
                    checked={authMode === 'per-widget'}
                    onChange={() => setAuthMode('per-widget')}
                  />
                  <div className="auth-option-content">
                    <strong>Widget-Specific Credentials</strong>
                    <p>Store credentials only for this widget (isolated session)</p>
                  </div>
                </label>

                {authMode === 'per-widget' && (
                  <div className="credential-group-selector">
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
                      placeholder="Login page URL (optional)"
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
                  </div>
                )}
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
                disabled={loading || !canCreate}
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
