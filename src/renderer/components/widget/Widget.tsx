import React, { useState, useCallback } from 'react';
import { RefreshCw, Trash2, Settings, ExternalLink, GripVertical } from 'lucide-react';
import { useWidgets } from '../../hooks/useWidgets';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { WidgetWebview } from './WidgetWebview';
import { WidgetEditor } from './WidgetEditor';
import type { Widget as WidgetType } from '../../../types/dashboard';

interface WidgetProps {
  widget: WidgetType;
}

export function Widget({ widget }: WidgetProps): React.ReactElement {
  const { deleteWidget } = useWidgets();
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

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <div className="widget-drag-handle" title="Drag to move">
            <GripVertical size={14} />
          </div>
          <span className="widget-title">{widget.name}</span>
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
