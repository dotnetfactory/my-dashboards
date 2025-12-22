import React, { useState } from 'react';
import { LayoutDashboard, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useDashboardContext } from '../../context/DashboardContext';

export function DashboardSidebar(): React.ReactElement {
  const { dashboards, currentDashboard, setCurrentDashboard, createDashboard, updateDashboard, deleteDashboard } =
    useDashboardContext();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (newName.trim()) {
      await createDashboard(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (editName.trim()) {
      await updateDashboard(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this dashboard and all its widgets?')) {
      await deleteDashboard(id);
    }
  };

  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-header">
        <h2>Dashboards</h2>
        <button className="icon-btn" onClick={() => setIsCreating(true)} title="New Dashboard">
          <Plus size={18} />
        </button>
      </div>

      {isCreating && (
        <div className="sidebar-item creating">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Dashboard name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <button className="icon-btn success" onClick={handleCreate}>
            <Check size={16} />
          </button>
          <button className="icon-btn" onClick={() => setIsCreating(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="sidebar-list">
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            className={`sidebar-item ${currentDashboard?.id === dashboard.id ? 'active' : ''}`}
            onClick={() => editingId !== dashboard.id && setCurrentDashboard(dashboard)}
          >
            {editingId === dashboard.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdate(dashboard.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="icon-btn success"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate(dashboard.id);
                  }}
                >
                  <Check size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(null);
                  }}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <LayoutDashboard size={18} />
                <span className="dashboard-name">{dashboard.name}</span>
                <div className="sidebar-actions">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(dashboard.id);
                      setEditName(dashboard.name);
                    }}
                    title="Rename"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(dashboard.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {dashboards.length === 0 && !isCreating && (
          <div className="sidebar-empty">
            <p>No dashboards yet</p>
            <button onClick={() => setIsCreating(true)}>Create your first dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
