/**
 * Picker Preload Script for My Dashboards
 *
 * This preload script is injected into the picker window to enable
 * element selection (CSS selector) and crop region selection.
 */

/* eslint-disable no-undef */
import { ipcRenderer } from 'electron';

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

interface Selection {
  url: string;
  selectorType: 'css' | 'crop';
  selectorData: { selectors: string[] } | CropRegion;
}

let mode: 'css' | 'crop' | null = null;
let highlightOverlay: HTMLElement | null = null;
let toolbar: HTMLElement | null = null;
let cropOverlay: HTMLElement | null = null;
let cropStartX = 0;
let cropStartY = 0;
let isCropping = false;

// Multi-selection support
let selectedElements: Element[] = [];
let selectedOverlays: HTMLElement[] = [];

// Generate a unique CSS selector for an element
function generateSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
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

// Inject styles without using innerHTML (to avoid CSP issues)
function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    #widget-picker-toolbar {
      position: fixed !important;
      top: 10px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      background: #1a1a2e !important;
      border-radius: 12px !important;
      padding: 12px 20px !important;
      display: flex !important;
      gap: 12px !important;
      align-items: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    #widget-picker-toolbar button {
      padding: 10px 20px !important;
      border: none !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    }
    #widget-picker-toolbar .mode-btn {
      background: #2d2d44 !important;
      color: #fff !important;
    }
    #widget-picker-toolbar .mode-btn:hover {
      background: #3d3d5c !important;
    }
    #widget-picker-toolbar .mode-btn.active {
      background: #6366f1 !important;
      color: #fff !important;
    }
    #widget-picker-toolbar .cancel-btn {
      background: #dc2626 !important;
      color: #fff !important;
    }
    #widget-picker-toolbar .cancel-btn:hover {
      background: #ef4444 !important;
    }
    #widget-picker-toolbar .done-btn {
      background: #22c55e !important;
      color: #fff !important;
      display: none !important;
    }
    #widget-picker-toolbar .done-btn:hover {
      background: #16a34a !important;
    }
    #widget-picker-toolbar .done-btn.visible {
      display: block !important;
    }
    #widget-picker-toolbar .status {
      color: #a1a1aa !important;
      font-size: 13px !important;
      margin-left: 8px !important;
    }
    #widget-picker-toolbar .selection-count {
      background: #6366f1 !important;
      color: #fff !important;
      padding: 4px 12px !important;
      border-radius: 16px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      display: none !important;
    }
    #widget-picker-toolbar .selection-count.visible {
      display: block !important;
    }
    #widget-picker-highlight {
      position: fixed !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
      border: 3px solid #6366f1 !important;
      background: rgba(99, 102, 241, 0.15) !important;
      transition: all 0.1s ease !important;
    }
    #widget-picker-crop-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 2147483645 !important;
      cursor: crosshair !important;
    }
    #widget-picker-crop-selection {
      position: fixed !important;
      border: 3px dashed #6366f1 !important;
      background: rgba(99, 102, 241, 0.2) !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
    }
    .widget-picker-selected {
      position: fixed !important;
      pointer-events: none !important;
      z-index: 2147483645 !important;
      border: 3px solid #22c55e !important;
      background: rgba(34, 197, 94, 0.15) !important;
    }
  `;
  document.head.appendChild(style);
}

// Create the floating toolbar
function createToolbar(): void {
  // Inject styles first
  injectStyles();

  toolbar = document.createElement('div');
  toolbar.id = 'widget-picker-toolbar';

  // Create buttons programmatically to avoid innerHTML CSP issues
  const cssBtn = document.createElement('button');
  cssBtn.className = 'mode-btn';
  cssBtn.id = 'btn-css';
  cssBtn.textContent = 'Select Elements';
  cssBtn.addEventListener('click', () => enterCssMode());

  const cropBtn = document.createElement('button');
  cropBtn.className = 'mode-btn';
  cropBtn.id = 'btn-crop';
  cropBtn.textContent = 'Crop Region';
  cropBtn.addEventListener('click', () => enterCropMode());

  const selectionCount = document.createElement('span');
  selectionCount.className = 'selection-count';
  selectionCount.id = 'selection-count';
  selectionCount.textContent = '0 selected';

  const status = document.createElement('span');
  status.className = 'status';
  status.id = 'picker-status';
  status.textContent = 'Choose a selection mode';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'done-btn';
  doneBtn.id = 'btn-done';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => finishSelection());

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.id = 'btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => cancel());

  toolbar.appendChild(cssBtn);
  toolbar.appendChild(cropBtn);
  toolbar.appendChild(selectionCount);
  toolbar.appendChild(status);
  toolbar.appendChild(doneBtn);
  toolbar.appendChild(cancelBtn);

  document.body.appendChild(toolbar);
}

// Create highlight overlay for CSS mode
function createHighlightOverlay(): void {
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'widget-picker-highlight';
  highlightOverlay.style.display = 'none';
  document.body.appendChild(highlightOverlay);
}

// Enter CSS selector mode
function enterCssMode(): void {
  mode = 'css';
  updateToolbarState();
  if (cropOverlay) {
    cropOverlay.remove();
    cropOverlay = null;
  }
  document.addEventListener('mousemove', handleCssMouseMove);
  document.addEventListener('click', handleCssClick, true);
  updateStatus('Click elements to select. Click again to deselect. Click Done when finished.');
}

// Enter crop region mode
function enterCropMode(): void {
  mode = 'crop';
  updateToolbarState();
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
  document.removeEventListener('mousemove', handleCssMouseMove);
  document.removeEventListener('click', handleCssClick, true);

  // Create crop overlay
  cropOverlay = document.createElement('div');
  cropOverlay.id = 'widget-picker-crop-overlay';
  document.body.appendChild(cropOverlay);

  cropOverlay.addEventListener('mousedown', handleCropStart);
  cropOverlay.addEventListener('mousemove', handleCropMove);
  cropOverlay.addEventListener('mouseup', handleCropEnd);

  updateStatus('Click and drag to select a region');
}

// Update toolbar button states
function updateToolbarState(): void {
  const cssBtn = document.getElementById('btn-css');
  const cropBtn = document.getElementById('btn-crop');
  cssBtn?.classList.toggle('active', mode === 'css');
  cropBtn?.classList.toggle('active', mode === 'crop');
}

// Update status text
function updateStatus(text: string): void {
  const status = document.getElementById('picker-status');
  if (status) {
    status.textContent = text;
  }
}

// Handle mouse move in CSS mode
function handleCssMouseMove(e: MouseEvent): void {
  if (mode !== 'css' || !highlightOverlay) return;

  const target = e.target as Element;
  if (target === highlightOverlay || target === toolbar || toolbar?.contains(target)) {
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

// Handle click in CSS mode
function handleCssClick(e: MouseEvent): void {
  if (mode !== 'css') return;

  const target = e.target as Element;
  if (target === toolbar || toolbar?.contains(target)) return;
  if (target === highlightOverlay) return;

  e.preventDefault();
  e.stopPropagation();

  // Check if element is already selected
  const existingIndex = selectedElements.indexOf(target);
  if (existingIndex !== -1) {
    // Deselect: remove from array and remove overlay
    selectedElements.splice(existingIndex, 1);
    selectedOverlays[existingIndex]?.remove();
    selectedOverlays.splice(existingIndex, 1);
    // Update indices on remaining overlays
    selectedOverlays.forEach((overlay, i) => {
      overlay.setAttribute('data-index', String(i + 1));
    });
  } else {
    // Select: add to array and create overlay
    selectedElements.push(target);
    createSelectedOverlay(target, selectedElements.length);
  }

  updateSelectionCount();
}

// Create an overlay for a selected element
function createSelectedOverlay(element: Element, index: number): void {
  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'widget-picker-selected';
  overlay.setAttribute('data-index', String(index));
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  document.body.appendChild(overlay);
  selectedOverlays.push(overlay);
}

// Update the selection count display
function updateSelectionCount(): void {
  const countEl = document.getElementById('selection-count');
  const doneBtn = document.getElementById('btn-done');
  const count = selectedElements.length;

  if (countEl) {
    countEl.textContent = `${count} selected`;
    countEl.classList.toggle('visible', count > 0);
  }
  if (doneBtn) {
    doneBtn.classList.toggle('visible', count > 0);
  }
}

// Finish selection and send result
function finishSelection(): void {
  if (selectedElements.length === 0) return;

  const selectors = selectedElements.map(el => generateSelector(el));
  const selection: Selection = {
    url: window.location.href,
    selectorType: 'css',
    selectorData: { selectors },
  };

  cleanup();
  ipcRenderer.send('picker:selection', selection);
}

// Crop region selection variables
let cropSelection: HTMLElement | null = null;

// Handle crop start
function handleCropStart(e: MouseEvent): void {
  if (mode !== 'crop') return;

  isCropping = true;
  cropStartX = e.clientX;
  cropStartY = e.clientY;

  // Create selection rectangle
  cropSelection = document.createElement('div');
  cropSelection.id = 'widget-picker-crop-selection';
  cropSelection.style.left = `${cropStartX}px`;
  cropSelection.style.top = `${cropStartY}px`;
  cropSelection.style.width = '0px';
  cropSelection.style.height = '0px';
  document.body.appendChild(cropSelection);
}

// Handle crop move
function handleCropMove(e: MouseEvent): void {
  if (!isCropping || !cropSelection) return;

  const x = Math.min(e.clientX, cropStartX);
  const y = Math.min(e.clientY, cropStartY);
  const width = Math.abs(e.clientX - cropStartX);
  const height = Math.abs(e.clientY - cropStartY);

  cropSelection.style.left = `${x}px`;
  cropSelection.style.top = `${y}px`;
  cropSelection.style.width = `${width}px`;
  cropSelection.style.height = `${height}px`;
}

// Handle crop end
function handleCropEnd(e: MouseEvent): void {
  if (!isCropping || mode !== 'crop') return;

  isCropping = false;

  const x = Math.min(e.clientX, cropStartX);
  const y = Math.min(e.clientY, cropStartY);
  const width = Math.abs(e.clientX - cropStartX);
  const height = Math.abs(e.clientY - cropStartY);

  // Minimum size check
  if (width < 50 || height < 50) {
    cropSelection?.remove();
    cropSelection = null;
    updateStatus('Selection too small. Try again.');
    return;
  }

  const selection: Selection = {
    url: window.location.href,
    selectorType: 'crop',
    selectorData: {
      x,
      y,
      width,
      height,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
  };

  cleanup();
  ipcRenderer.send('picker:selection', selection);
}

// Cancel selection
function cancel(): void {
  cleanup();
  window.close();
}

// Cleanup UI elements
function cleanup(): void {
  mode = null;
  document.removeEventListener('mousemove', handleCssMouseMove);
  document.removeEventListener('click', handleCssClick, true);
  highlightOverlay?.remove();
  toolbar?.remove();
  cropOverlay?.remove();
  cropSelection?.remove();
  // Clean up multi-selection overlays
  selectedOverlays.forEach(overlay => overlay.remove());
  selectedOverlays = [];
  selectedElements = [];
  highlightOverlay = null;
  toolbar = null;
  cropOverlay = null;
  cropSelection = null;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init(): void {
  // Wait a bit for SPAs to render their content
  // This helps with sites like YouTube Studio that load content dynamically
  const tryInit = () => {
    if (!document.body) {
      console.log('[Picker] Waiting for body...');
      setTimeout(tryInit, 500);
      return;
    }
    console.log('[Picker] Initializing toolbar...');
    try {
      createToolbar();
      createHighlightOverlay();
      console.log('[Picker] Toolbar created successfully');
    } catch (err) {
      console.error('[Picker] Failed to create toolbar:', err);
    }
  };

  // Initial delay to let SPAs render
  setTimeout(tryInit, 1000);
}
