import React, { useState } from 'react';
import { Key, Trash2, Plus, Users } from 'lucide-react';
import { useCredentialGroups } from '../../hooks/useCredentialGroups';
import { CredentialGroupCreator } from './CredentialGroupCreator';
import type { CredentialGroup, CreateCredentialGroupData } from '../../../types/dashboard';

interface CredentialGroupManagerProps {
  onClose?: () => void;
}

export function CredentialGroupManager({ onClose }: CredentialGroupManagerProps): React.ReactElement {
  const { groups, loading, createGroup, deleteGroup } = useCredentialGroups();
  const [showCreator, setShowCreator] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreate = async (data: CreateCredentialGroupData) => {
    await createGroup(data);
    setShowCreator(false);
  };

  const handleDelete = async (id: string) => {
    await deleteGroup(id);
    setDeleteConfirm(null);
  };

  if (showCreator) {
    return (
      <CredentialGroupCreator
        onClose={() => setShowCreator(false)}
        onCreate={handleCreate}
      />
    );
  }

  return (
    <div className="credential-group-manager">
      <div className="manager-header">
        <div className="header-title">
          <Key size={24} />
          <h2>Credential Groups</h2>
        </div>
        <p className="manager-description">
          Credential groups let you share login credentials and sessions across multiple widgets.
          Widgets using the same group will share cookies and stay logged in together.
        </p>
      </div>

      <div className="manager-actions">
        <button className="primary" onClick={() => setShowCreator(true)}>
          <Plus size={16} />
          New Credential Group
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading credential groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No credential groups yet</h3>
          <p>
            Create a credential group to share login credentials across multiple widgets.
          </p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map((group) => (
            <CredentialGroupItem
              key={group.id}
              group={group}
              isDeleting={deleteConfirm === group.id}
              onDeleteClick={() => setDeleteConfirm(group.id)}
              onDeleteConfirm={() => handleDelete(group.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
            />
          ))}
        </div>
      )}

      {onClose && (
        <div className="manager-footer">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

interface CredentialGroupItemProps {
  group: CredentialGroup;
  isDeleting: boolean;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function CredentialGroupItem({
  group,
  isDeleting,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: CredentialGroupItemProps): React.ReactElement {
  return (
    <div className="group-item">
      <div className="group-info">
        <div className="group-icon">
          <Key size={20} />
        </div>
        <div className="group-details">
          <h4>{group.name}</h4>
          <p className="group-meta">
            <span className="username">{group.username}</span>
            <span className="separator">•</span>
            <span className="login-url">{new URL(group.loginUrl).hostname}</span>
          </p>
        </div>
      </div>
      <div className="group-actions">
        {isDeleting ? (
          <>
            <span className="delete-confirm-text">Delete?</span>
            <button className="danger small" onClick={onDeleteConfirm}>
              Yes
            </button>
            <button className="secondary small" onClick={onDeleteCancel}>
              No
            </button>
          </>
        ) : (
          <button className="icon-btn danger" onClick={onDeleteClick} title="Delete group">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
