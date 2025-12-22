import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Key, Globe, MousePointer, Check } from 'lucide-react';
import type { CreateCredentialGroupData } from '../../../types/dashboard';

interface CredentialGroupCreatorProps {
  onClose: () => void;
  onCreate: (data: CreateCredentialGroupData) => Promise<void>;
  defaultLoginUrl?: string;
}

type Step = 'name' | 'credentials' | 'selectors';

export function CredentialGroupCreator({
  onClose,
  onCreate,
  defaultLoginUrl = '',
}: CredentialGroupCreatorProps): React.ReactElement {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [loginUrl, setLoginUrl] = useState(defaultLoginUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameSelector, setUsernameSelector] = useState('');
  const [passwordSelector, setPasswordSelector] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeUrl = (input: string): string => {
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      return `https://${input}`;
    }
    return input;
  };

  const handleOpenCredentialPicker = async () => {
    setLoading(true);
    try {
      const result = await window.api.credentialPicker.open(loginUrl);
      if (result.success && result.data) {
        setUsernameSelector(result.data.usernameSelector);
        setPasswordSelector(result.data.passwordSelector);
        setSubmitSelector(result.data.submitSelector);
      }
    } catch (err) {
      console.error('Credential picker failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      await onCreate({
        name,
        username,
        password,
        loginUrl,
        usernameSelector,
        passwordSelector,
        submitSelector,
      });
      onClose();
    } catch (err) {
      console.error('Failed to create credential group:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasSelectors = usernameSelector && passwordSelector;

  const renderStep = () => {
    switch (step) {
      case 'name':
        return (
          <div className="creator-step">
            <div className="step-header">
              <Key size={24} />
              <h3>Credential Group</h3>
              <p>Give this group a name and specify the login page URL</p>
            </div>
            <div className="step-content">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name (e.g., Google Analytics, Umami)"
                autoFocus
              />
              <input
                type="text"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder="Login page URL"
              />
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  setLoginUrl(normalizeUrl(loginUrl));
                  setStep('credentials');
                }}
                disabled={!name || !loginUrl}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="creator-step">
            <div className="step-header">
              <Globe size={24} />
              <h3>Login Credentials</h3>
              <p>Enter the username and password for this service</p>
            </div>
            <div className="step-content">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email"
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={() => setStep('name')}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                className="primary"
                onClick={() => setStep('selectors')}
                disabled={!username || !password}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 'selectors':
        return (
          <div className="creator-step">
            <div className="step-header">
              <MousePointer size={24} />
              <h3>Login Form Fields</h3>
              <p>Select the login form fields on the page</p>
            </div>
            <div className="step-content">
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
                  Click to open the login page and select the username field, password field, and
                  submit button
                </p>
              </div>
            </div>
            <div className="step-actions">
              <button className="secondary" onClick={() => setStep('credentials')}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                className="primary"
                onClick={handleCreate}
                disabled={loading || !hasSelectors}
              >
                Create Group
                {loading && <div className="spinner small"></div>}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="widget-creator-overlay">
      <div className="widget-creator">
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="creator-progress">
          <div className={`progress-step ${step === 'name' ? 'active' : ''}`}>1. Name</div>
          <div className={`progress-step ${step === 'credentials' ? 'active' : ''}`}>
            2. Credentials
          </div>
          <div className={`progress-step ${step === 'selectors' ? 'active' : ''}`}>
            3. Form Fields
          </div>
        </div>

        {renderStep()}
      </div>
    </div>
  );
}
