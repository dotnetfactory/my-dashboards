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

// Create the floating toolbar
function createToolbar(): void {
  toolbar = document.createElement('div');
  toolbar.id = 'widget-picker-toolbar';
  toolbar.innerHTML = `
    <style>
      #widget-picker-toolbar {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #1a1a2e;
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        gap: 12px;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      #widget-picker-toolbar button {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      #widget-picker-toolbar .mode-btn {
        background: #2d2d44;
        color: #fff;
      }
      #widget-picker-toolbar .mode-btn:hover {
        background: #3d3d5c;
      }
      #widget-picker-toolbar .mode-btn.active {
        background: #6366f1;
        color: #fff;
      }
      #widget-picker-toolbar .cancel-btn {
        background: #dc2626;
        color: #fff;
      }
      #widget-picker-toolbar .cancel-btn:hover {
        background: #ef4444;
      }
      #widget-picker-toolbar .done-btn {
        background: #22c55e;
        color: #fff;
        display: none;
      }
      #widget-picker-toolbar .done-btn:hover {
        background: #16a34a;
      }
      #widget-picker-toolbar .done-btn.visible {
        display: block;
      }
      #widget-picker-toolbar .status {
        color: #a1a1aa;
        font-size: 13px;
        margin-left: 8px;
      }
      #widget-picker-toolbar .selection-count {
        background: #6366f1;
        color: #fff;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 600;
        display: none;
      }
      #widget-picker-toolbar .selection-count.visible {
        display: block;
      }
      #widget-picker-highlight {
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 3px solid #6366f1;
        background: rgba(99, 102, 241, 0.15);
        transition: all 0.1s ease;
      }
      #widget-picker-crop-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483645;
        cursor: crosshair;
      }
      #widget-picker-crop-selection {
        position: fixed;
        border: 3px dashed #6366f1;
        background: rgba(99, 102, 241, 0.2);
        z-index: 2147483646;
        pointer-events: none;
      }
      .widget-picker-selected {
        position: fixed;
        pointer-events: none;
        z-index: 2147483645;
        border: 3px solid #22c55e;
        background: rgba(34, 197, 94, 0.15);
      }
      .widget-picker-selected::after {
        content: attr(data-index);
        position: absolute;
        top: -12px;
        left: -12px;
        width: 24px;
        height: 24px;
        background: #22c55e;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    </style>
    <button class="mode-btn" id="btn-css">Select Elements</button>
    <button class="mode-btn" id="btn-crop">Crop Region</button>
    <span class="selection-count" id="selection-count">0 selected</span>
    <span class="status" id="picker-status">Choose a selection mode</span>
    <button class="done-btn" id="btn-done">Done</button>
    <button class="cancel-btn" id="btn-cancel">Cancel</button>
  `;
  document.body.appendChild(toolbar);

  // Button handlers
  document.getElementById('btn-css')?.addEventListener('click', () => enterCssMode());
  document.getElementById('btn-crop')?.addEventListener('click', () => enterCropMode());
  document.getElementById('btn-done')?.addEventListener('click', () => finishSelection());
  document.getElementById('btn-cancel')?.addEventListener('click', () => cancel());
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
  createToolbar();
  createHighlightOverlay();
}
