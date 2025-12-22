/* eslint-disable react/no-unknown-property */
import React, { useRef, useEffect, useState } from 'react';
import type { Widget, CssSelectorData, CropSelectorData, WidgetCredentials } from '../../../types/dashboard';

interface WidgetWebviewProps {
  widget: Widget;
  refreshKey: number;
}

export function WidgetWebview({ widget, refreshKey }: WidgetWebviewProps): React.ReactElement {
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const zoomLevelRef = useRef(widget.zoomLevel);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep zoom level ref updated
  useEffect(() => {
    zoomLevelRef.current = widget.zoomLevel;
  }, [widget.zoomLevel]);

  // Fallback timeout to clear loading state after 30 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Widget loading timeout - forcing loading state to false');
        setLoading(false);
      }
    }, 4000);
    return () => clearTimeout(timeout);
  }, [loading, refreshKey]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = async () => {
      try {
        setLoading(false);

        // Apply zoom level using webview's native zoom
        try {
          webview.setZoomFactor(zoomLevelRef.current);
        } catch (err) {
          console.error('Failed to set zoom factor:', err);
        }

        const currentUrl = webview.getURL().toLowerCase();

      // Check if we're on a login page
      const loginPatterns = ['login', 'signin', 'sign-in', 'auth', 'account'];
      const hasPasswordField = await webview.executeJavaScript(
        `!!document.querySelector('input[type="password"]')`
      );

      const isOnLoginPage = hasPasswordField || loginPatterns.some((p) => currentUrl.includes(p));

      // If widget has credentials and we're on a login page, handle login first
      if (widget.hasCredentials && isOnLoginPage) {
        try {
          const result = await window.api.credentials.get(widget.id);
          if (result.success && result.data) {
            const credentials = result.data as WidgetCredentials;

            // Check if credentials' loginUrl matches (if specified)
            const shouldLogin =
              !credentials.loginUrl ||
              currentUrl.includes(credentials.loginUrl.toLowerCase());

            if (shouldLogin) {
              // Perform auto-login - the page will navigate after login
              // Don't apply CSS selectors yet - wait for next dom-ready after navigation
              await performAutoLogin(webview, credentials);
              return; // Exit early - CSS will be applied after successful navigation
            }
          }
        } catch (err) {
          console.error('Auto-login failed:', err);
        }
      }

      // After login, we might be on a different page than the widget URL
      // Check if we need to navigate to the actual widget URL
      const targetPath = new URL(widget.url).pathname.toLowerCase();
      const currentPath = new URL(currentUrl).pathname.toLowerCase();

      // If widget has a specific path and we're not on it, navigate there
      if (!isOnLoginPage && targetPath && targetPath !== '/' && currentPath !== targetPath) {
        console.log('Navigating to widget URL:', widget.url, 'current:', currentPath, 'target:', targetPath);
        webview.loadURL(widget.url);
        return; // Wait for next dom-ready after navigation
      }

      // Only apply CSS selector hiding if NOT on a login page and we're on the correct page
      if (!isOnLoginPage && widget.selectorType === 'css') {
        const selectorData = widget.selectorData as CssSelectorData;
        const selectors = selectorData.selectors;

        // Wait for React/SPA content to render (dom-ready fires before JS frameworks finish)
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
          // Check if the selected elements exist on this page
          const elementsExist = await webview.executeJavaScript(`
            (function() {
              const selectors = ${JSON.stringify(selectors)};
              console.log('Checking selectors:', selectors);
              const results = selectors.map(sel => ({ sel, found: !!document.querySelector(sel) }));
              console.log('Selector results:', results);
              return selectors.some(sel => document.querySelector(sel) !== null);
            })();
          `);

          console.log('Elements exist:', elementsExist, 'Selectors:', selectors);

          if (elementsExist) {
            // Use CSS-only approach: hide everything, then show selected elements and ALL their contents
            const selectorsWithChildren = selectors.map(s => `${s}, ${s} *`).join(',\n');

            await webview.insertCSS(`
              /* First, hide everything in body */
              body * {
                visibility: hidden !important;
              }

              /* Show the selected elements and ALL their descendants */
              ${selectorsWithChildren} {
                visibility: visible !important;
              }
            `);

            // Use JS to show ancestors (CSS can't select ancestors) and position content
            await webview.executeJavaScript(`
              (function() {
                const selectors = ${JSON.stringify(selectors)};
                const selectedElements = selectors.map(s => document.querySelector(s)).filter(Boolean);

                if (selectedElements.length === 0) return;

                // Make all ancestors visible
                selectedElements.forEach(el => {
                  let current = el.parentElement;
                  while (current && current !== document.body) {
                    current.style.visibility = 'visible';
                    current = current.parentElement;
                  }
                });

                // Also make body visible
                document.body.style.visibility = 'visible';

                // Find the bounding box of all selected elements
                let minTop = Infinity;
                selectedElements.forEach(el => {
                  const rect = el.getBoundingClientRect();
                  minTop = Math.min(minTop, rect.top + window.scrollY);
                });

                // Scroll to position the first element at the top with a small margin
                window.scrollTo(0, Math.max(0, minTop - 10));

                console.log('Widget display: showing', selectedElements.length, 'elements, scrolled to', minTop);
              })();
            `);
          } else {
            console.warn('CSS selectors not found on page:', selectors);
          }
        } catch (err) {
          console.error('Failed to inject CSS:', err);
        }
      }

      // Apply crop scrolling if needed (also skip on login pages)
      if (!isOnLoginPage && widget.selectorType === 'crop') {
        const cropData = widget.selectorData as CropSelectorData;
        try {
          await webview.executeJavaScript(
            `window.scrollTo(${cropData.scrollX}, ${cropData.scrollY})`
          );
        } catch (err) {
          console.error('Failed to scroll:', err);
        }
      }
      } catch (err) {
        console.error('Error in handleDomReady:', err);
        setLoading(false);
      }
    };

    const handleLoadStart = () => {
      setLoading(true);
      setError(null);
    };

    const handleDidFail = (e: Electron.DidFailLoadEvent) => {
      if (e.errorCode !== -3) {
        // Ignore aborted loads
        setError(`Failed to load: ${e.errorDescription}`);
      }
      setLoading(false);
    };

    const handleDidFinishLoad = () => {
      setLoading(false);
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-fail-load', handleDidFail);
    webview.addEventListener('did-finish-load', handleDidFinishLoad);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-fail-load', handleDidFail);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
    };
  }, [widget.id, widget.url, widget.hasCredentials, widget.selectorType, widget.selectorData, refreshKey]);

  // Reload webview when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0 && webviewRef.current) {
      webviewRef.current.reload();
    }
  }, [refreshKey]);

  // Update zoom level when it changes (without reload)
  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      try {
        webview.setZoomFactor(widget.zoomLevel);
      } catch {
        // Webview might not be ready yet, ignore
      }
    }
  }, [widget.zoomLevel]);

  const performAutoLogin = async (
    webview: Electron.WebviewTag,
    credentials: WidgetCredentials
  ) => {
    try {
      const usernameSelector = credentials.usernameSelector;
      const passwordSelector = credentials.passwordSelector;
      const submitSelector = credentials.submitSelector;

      // Helper to type text using keyboard events via webview
      const typeText = async (selector: string, text: string) => {
        // Focus the element first
        await webview.executeJavaScript(`
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el) {
              el.focus();
              el.select();
              // Clear the field
              el.value = '';
            }
          })();
        `);

        // Wait a bit for focus
        await new Promise(resolve => setTimeout(resolve, 50));

        // Type each character using sendInputEvent
        for (const char of text) {
          // Send keyDown event
          webview.sendInputEvent({
            type: 'keyDown',
            keyCode: char,
          } as Electron.KeyboardInputEvent);
          // Send char event
          webview.sendInputEvent({
            type: 'char',
            keyCode: char,
          } as Electron.KeyboardInputEvent);
          // Send keyUp event
          webview.sendInputEvent({
            type: 'keyUp',
            keyCode: char,
          } as Electron.KeyboardInputEvent);
          // Small delay between characters
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        // Wait for the typing to be processed
        await new Promise(resolve => setTimeout(resolve, 50));
      };

      // Check if elements exist
      const elementsExist = await webview.executeJavaScript(`
        (function() {
          const u = document.querySelector(${JSON.stringify(usernameSelector)});
          const p = document.querySelector(${JSON.stringify(passwordSelector)});
          console.log('Auto-login: found fields', { username: !!u, password: !!p });
          return !!(u && p);
        })();
      `);

      if (elementsExist) {
        // Type username
        await typeText(usernameSelector, credentials.username);

        // Type password
        await typeText(passwordSelector, credentials.password);

        // Click submit
        await webview.executeJavaScript(`
          (function() {
            const btn = document.querySelector(${JSON.stringify(submitSelector)});
            if (btn) {
              btn.click();
            }
          })();
        `);
      } else {
        console.warn('Auto-login: Could not find username or password field');
      }
    } catch (err) {
      console.error('Auto-login script failed:', err);
    }
  };

  // Calculate webview style based on selector type
  const getWebviewStyle = (): React.CSSProperties => {
    if (widget.selectorType === 'crop') {
      const cropData = widget.selectorData as CropSelectorData;
      return {
        width: cropData.width,
        height: cropData.height,
      };
    }
    return {
      width: '100%',
      height: '100%',
    };
  };

  return (
    <div className="widget-webview-container">
      {loading && (
        <div className="widget-loading">
          <div className="spinner"></div>
          <span>Loading...</span>
        </div>
      )}
      {error && (
        <div className="widget-error">
          <span>{error}</span>
          <button onClick={() => webviewRef.current?.reload()}>Retry</button>
        </div>
      )}
      <webview
        ref={webviewRef}
        src={widget.url}
        partition={`persist:${widget.partition}`}
        style={{
          ...getWebviewStyle(),
          display: 'flex',
          flex: 1,
        }}
      />
    </div>
  );
}
