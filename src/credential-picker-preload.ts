/**
 * Credential Picker Preload Script for My Dashboards
 *
 * This preload script is injected into the credential picker window to enable
 * selection of login form fields (username, password, submit button).
 */

/* eslint-disable no-undef */
import { ipcRenderer } from 'electron';

interface CredentialSelection {
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
}

let currentStep: 'username' | 'password' | 'submit' = 'username';
let highlightOverlay: HTMLElement | null = null;
let toolbar: HTMLElement | null = null;
let selection: CredentialSelection = {
  usernameSelector: '',
  passwordSelector: '',
  submitSelector: '',
};

// Generate a unique CSS selector for an element
function generateSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try name attribute for form inputs
  if (element.hasAttribute('name')) {
    const name = element.getAttribute('name');
    const tag = element.tagName.toLowerCase();
    const selector = `${tag}[name="${name}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // Try type attribute for inputs
  if (element.tagName === 'INPUT') {
    const type = element.getAttribute('type') || 'text';
    const selector = `input[type="${type}"]`;
    const matches = document.querySelectorAll(selector);
    if (matches.length === 1) {
      return selector;
    }
    // Add index if multiple
    const index = Array.from(matches).indexOf(element as HTMLInputElement);
    if (index !== -1) {
      return `${selector}:nth-of-type(${index + 1})`;
    }
  }

  // Try unique class combination
  if (element.classList.length > 0) {
    const classSelector = Array.from(element.classList)
      .map((c) => `.${CSS.escape(c)}`)
      .join('');
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }

  // Build path from root
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    // Add nth-child if needed
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

// Create the floating toolbar
function createToolbar(): void {
  toolbar = document.createElement('div');
  toolbar.id = 'credential-picker-toolbar';
  toolbar.innerHTML = `
    <style>
      #credential-picker-toolbar {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #1a1a2e;
        border-radius: 12px;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 400px;
      }
      #credential-picker-toolbar .title {
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      #credential-picker-toolbar .steps {
        display: flex;
        gap: 8px;
        width: 100%;
      }
      #credential-picker-toolbar .step {
        flex: 1;
        padding: 10px 16px;
        border-radius: 8px;
        background: #2d2d44;
        color: #a1a1aa;
        font-size: 13px;
        text-align: center;
        transition: all 0.2s ease;
      }
      #credential-picker-toolbar .step.active {
        background: #6366f1;
        color: #fff;
      }
      #credential-picker-toolbar .step.done {
        background: #22c55e;
        color: #fff;
      }
      #credential-picker-toolbar .step-label {
        font-weight: 500;
      }
      #credential-picker-toolbar .step-value {
        font-size: 11px;
        opacity: 0.8;
        margin-top: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
      }
      #credential-picker-toolbar .instructions {
        color: #a1a1aa;
        font-size: 14px;
        text-align: center;
      }
      #credential-picker-toolbar .buttons {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }
      #credential-picker-toolbar button {
        padding: 10px 24px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      #credential-picker-toolbar .skip-btn {
        background: #3d3d5c;
        color: #fff;
      }
      #credential-picker-toolbar .skip-btn:hover {
        background: #4d4d6c;
      }
      #credential-picker-toolbar .done-btn {
        background: #22c55e;
        color: #fff;
        display: none;
      }
      #credential-picker-toolbar .done-btn:hover {
        background: #16a34a;
      }
      #credential-picker-toolbar .done-btn.visible {
        display: block;
      }
      #credential-picker-toolbar .cancel-btn {
        background: #dc2626;
        color: #fff;
      }
      #credential-picker-toolbar .cancel-btn:hover {
        background: #ef4444;
      }
      #credential-picker-highlight {
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 3px solid #6366f1;
        background: rgba(99, 102, 241, 0.15);
        transition: all 0.1s ease;
      }
      .credential-selected-field {
        outline: 3px solid #22c55e !important;
        outline-offset: 2px;
      }
    </style>
    <div class="title">Select Login Form Fields</div>
    <div class="steps">
      <div class="step active" id="step-username">
        <div class="step-label">1. Username</div>
        <div class="step-value" id="value-username">Click to select</div>
      </div>
      <div class="step" id="step-password">
        <div class="step-label">2. Password</div>
        <div class="step-value" id="value-password">Click to select</div>
      </div>
      <div class="step" id="step-submit">
        <div class="step-label">3. Submit</div>
        <div class="step-value" id="value-submit">Click to select</div>
      </div>
    </div>
    <div class="instructions" id="instructions">Click on the username/email input field</div>
    <div class="buttons">
      <button class="skip-btn" id="btn-skip">Skip This Field</button>
      <button class="done-btn" id="btn-done">Done</button>
      <button class="cancel-btn" id="btn-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(toolbar);

  // Button handlers
  document.getElementById('btn-skip')?.addEventListener('click', skipCurrentStep);
  document.getElementById('btn-done')?.addEventListener('click', finishSelection);
  document.getElementById('btn-cancel')?.addEventListener('click', cancel);
}

// Create highlight overlay
function createHighlightOverlay(): void {
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'credential-picker-highlight';
  highlightOverlay.style.display = 'none';
  document.body.appendChild(highlightOverlay);
}

// Update toolbar UI based on current state
function updateToolbarUI(): void {
  const steps = ['username', 'password', 'submit'] as const;

  steps.forEach((step) => {
    const stepEl = document.getElementById(`step-${step}`);
    const valueEl = document.getElementById(`value-${step}`);

    if (stepEl && valueEl) {
      stepEl.classList.remove('active', 'done');

      if (step === currentStep) {
        stepEl.classList.add('active');
      } else if (selection[`${step}Selector` as keyof CredentialSelection]) {
        stepEl.classList.add('done');
        valueEl.textContent = selection[`${step}Selector` as keyof CredentialSelection].slice(0, 20) + '...';
      }
    }
  });

  // Update instructions
  const instructions = document.getElementById('instructions');
  if (instructions) {
    switch (currentStep) {
      case 'username':
        instructions.textContent = 'Click on the username/email input field';
        break;
      case 'password':
        instructions.textContent = 'Click on the password input field';
        break;
      case 'submit':
        instructions.textContent = 'Click on the login/submit button';
        break;
    }
  }

  // Show done button if at least username and password are selected
  const doneBtn = document.getElementById('btn-done');
  if (doneBtn) {
    const hasRequired = selection.usernameSelector && selection.passwordSelector;
    doneBtn.classList.toggle('visible', !!hasRequired);
  }
}

// Skip current step
function skipCurrentStep(): void {
  moveToNextStep();
}

// Move to next step
function moveToNextStep(): void {
  if (currentStep === 'username') {
    currentStep = 'password';
  } else if (currentStep === 'password') {
    currentStep = 'submit';
  }
  updateToolbarUI();
}

// Handle mouse move
function handleMouseMove(e: MouseEvent): void {
  if (!highlightOverlay) return;

  const target = e.target as Element;
  if (target === highlightOverlay || target === toolbar || toolbar?.contains(target)) {
    highlightOverlay.style.display = 'none';
    return;
  }

  // Only highlight interactive elements for relevant steps
  let shouldHighlight = false;

  if (currentStep === 'username' || currentStep === 'password') {
    shouldHighlight = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  } else if (currentStep === 'submit') {
    shouldHighlight = target.tagName === 'BUTTON' ||
                      target.tagName === 'INPUT' ||
                      target.tagName === 'A' ||
                      target.closest('button') !== null;
  }

  if (!shouldHighlight) {
    highlightOverlay.style.display = 'none';
    return;
  }

  const rect = target.getBoundingClientRect();
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.top = `${rect.top}px`;
  highlightOverlay.style.left = `${rect.left}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
}

// Handle click
function handleClick(e: MouseEvent): void {
  const target = e.target as Element;
  if (target === toolbar || toolbar?.contains(target)) return;
  if (target === highlightOverlay) return;

  e.preventDefault();
  e.stopPropagation();

  // Get the actual clickable element (for buttons that might have nested elements)
  let element = target;
  if (currentStep === 'submit' && target.closest('button')) {
    element = target.closest('button')!;
  }

  const selector = generateSelector(element);

  // Remove previous selection highlight
  document.querySelectorAll('.credential-selected-field').forEach(el => {
    el.classList.remove('credential-selected-field');
  });

  // Store selection and highlight
  switch (currentStep) {
    case 'username':
      selection.usernameSelector = selector;
      element.classList.add('credential-selected-field');
      break;
    case 'password':
      selection.passwordSelector = selector;
      element.classList.add('credential-selected-field');
      break;
    case 'submit':
      selection.submitSelector = selector;
      element.classList.add('credential-selected-field');
      break;
  }

  moveToNextStep();
}

// Finish selection
function finishSelection(): void {
  if (!selection.usernameSelector || !selection.passwordSelector) {
    return; // Need at least username and password
  }

  cleanup();
  ipcRenderer.send('credentialPicker:selection', selection);
}

// Cancel selection
function cancel(): void {
  cleanup();
  window.close();
}

// Cleanup
function cleanup(): void {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleClick, true);
  highlightOverlay?.remove();
  toolbar?.remove();
  document.querySelectorAll('.credential-selected-field').forEach(el => {
    el.classList.remove('credential-selected-field');
  });
}

// Initialize
function init(): void {
  createToolbar();
  createHighlightOverlay();
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick, true);
  updateToolbarUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
