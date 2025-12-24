import React, { useState, useCallback } from 'react';
import { RefreshCw, Trash2, Settings, ExternalLink, GripVertical, Copy, ZoomIn, ZoomOut } from 'lucide-react';
import { useWidgets } from '../../hooks/useWidgets';
import { useDashboardContext } from '../../context/DashboardContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { WidgetWebview } from './WidgetWebview';
import { WidgetEditor } from './WidgetEditor';
import type { Widget as WidgetType } from '../../../types/dashboard';

interface WidgetProps {
  widget: WidgetType;
}

export function Widget({ widget }: WidgetProps): React.ReactElement {
  const { deleteWidget, createWidget, updateWidget } = useWidgets();
  const { refreshWidgets } = useDashboardContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditor, setShowEditor] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  // Set up auto-refresh based on widget.refreshInterval
  useAutoRefresh(widget, handleRefresh);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Delete widget "${widget.name}"?`)) {
      await deleteWidget(widget.id);
    }
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleRefresh();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowEditor(true);
  };

  const handleOpenExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.api.shell.openExternal(widget.url);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    handleRefresh(); // Refresh after editing
  };

  const handleZoomIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newZoom = Math.min(2, widget.zoomLevel + 0.1);
    await updateWidget(widget.id, { zoomLevel: newZoom });
  };

  const handleZoomOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newZoom = Math.max(0.25, widget.zoomLevel - 0.1);
    await updateWidget(widget.id, { zoomLevel: newZoom });
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newWidget = await createWidget({
      name: `${widget.name} (copy)`,
      url: widget.url,
      selectorType: widget.selectorType,
      selectorData: widget.selectorData,
      refreshInterval: widget.refreshInterval,
      zoomLevel: widget.zoomLevel,
      credentialGroupId: widget.credentialGroupId ?? undefined,
      // Preserve the partition so duplicated widget shares the same session
      // (credential group widgets get their partition from the group in handlers.ts)
      partition: widget.credentialGroupId ? undefined : widget.partition,
    });

    // Copy per-widget credentials if the original widget has them (not credential group)
    if (widget.hasCredentials && !widget.credentialGroupId && newWidget) {
      const credResult = await window.api.credentials.get(widget.id);
      if (credResult.success && credResult.data) {
        await window.api.credentials.save(newWidget.id, {
          username: credResult.data.username,
          password: credResult.data.password,
          loginUrl: credResult.data.loginUrl,
          usernameSelector: credResult.data.usernameSelector,
          passwordSelector: credResult.data.passwordSelector,
          submitSelector: credResult.data.submitSelector,
        });
        // Refresh widgets to get updated has_credentials flag
        await refreshWidgets();
      }
    }
  };

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <div className="widget-drag-handle" title="Drag to move">
            <GripVertical size={14} />
          </div>
          <span className="widget-title" onMouseDown={(e) => e.stopPropagation()}>{widget.name}</span>
          <div className="widget-controls" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="widget-btn"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              title="Refresh"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
            </button>
            <button className="widget-btn" onClick={handleOpenExternal} title="Open in browser">
              <ExternalLink size={14} />
            </button>
            <button
              className="widget-btn"
              onClick={handleZoomOut}
              disabled={widget.zoomLevel <= 0.25}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              className="widget-btn"
              onClick={handleZoomIn}
              disabled={widget.zoomLevel >= 2}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button className="widget-btn" onClick={handleDuplicate} title="Duplicate">
              <Copy size={14} />
            </button>
            <button className="widget-btn" onClick={handleEditClick} title="Settings">
              <Settings size={14} />
            </button>
            <button className="widget-btn danger" onClick={handleDelete} title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="widget-content">
          <WidgetWebview widget={widget} refreshKey={refreshKey} />
        </div>
      </div>
      {showEditor && <WidgetEditor widget={widget} onClose={handleEditorClose} />}
    </>
  );
}
