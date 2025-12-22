import React, { useState, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { Plus } from 'lucide-react';
import { useDashboardContext } from '../../context/DashboardContext';
import { useWidgets } from '../../hooks/useWidgets';
import { Widget } from '../widget/Widget';
import { WidgetCreator } from '../widget-creator/WidgetCreator';
import type { WidgetPosition } from '../../../types/dashboard';
import 'react-grid-layout/css/styles.css';

export function DashboardView(): React.ReactElement {
  const { currentDashboard, widgets } = useDashboardContext();
  const { updatePositions } = useWidgets();
  const [showCreator, setShowCreator] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

  if (!currentDashboard) {
    return (
      <div className="dashboard-view empty">
        <div className="empty-state">
          <h2>Welcome to My Dashboards</h2>
          <p>Create a dashboard from the sidebar to get started</p>
        </div>
      </div>
    );
  }

  const layout: Layout[] = widgets.map((widget) => ({
    i: widget.id,
    x: widget.gridCol,
    y: widget.gridRow,
    w: widget.gridColSpan,
    h: widget.gridRowSpan,
    minW: 2,
    minH: 2,
  }));

  const handleLayoutChange = (newLayout: Layout[]) => {
    const positions: WidgetPosition[] = newLayout.map((item) => ({
      id: item.i,
      gridCol: item.x,
      gridRow: item.y,
      gridColSpan: item.w,
      gridRowSpan: item.h,
    }));
    updatePositions(positions);
  };

  return (
    <div className="dashboard-view" ref={containerRef}>
      <div className="dashboard-header">
        <h1>{currentDashboard.name}</h1>
        <button className="add-widget-btn" onClick={() => setShowCreator(true)}>
          <Plus size={18} />
          Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="empty-dashboard">
          <h3>No widgets yet</h3>
          <p>Add a widget to display web content on your dashboard</p>
          <button onClick={() => setShowCreator(true)}>
            <Plus size={18} />
            Add your first widget
          </button>
        </div>
      ) : (
        <GridLayout
          className="dashboard-grid"
          layout={layout}
          cols={12}
          rowHeight={80}
          width={containerWidth}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <Widget widget={widget} />
            </div>
          ))}
        </GridLayout>
      )}

      {showCreator && <WidgetCreator onClose={() => setShowCreator(false)} />}
    </div>
  );
}
