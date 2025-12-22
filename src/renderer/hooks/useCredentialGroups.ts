import { useState, useEffect, useCallback } from 'react';
import type {
  CredentialGroup,
  CreateCredentialGroupData,
  UpdateCredentialGroupData,
} from '../../types/dashboard';

interface UseCredentialGroupsReturn {
  groups: CredentialGroup[];
  loading: boolean;
  createGroup: (data: CreateCredentialGroupData) => Promise<CredentialGroup | null>;
  updateGroup: (id: string, data: UpdateCredentialGroupData) => Promise<CredentialGroup | null>;
  deleteGroup: (id: string) => Promise<boolean>;
  refreshGroups: () => Promise<void>;
}

export function useCredentialGroups(): UseCredentialGroupsReturn {
  const [groups, setGroups] = useState<CredentialGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGroups = useCallback(async () => {
    try {
      const result = await window.api.credentialGroups.list();
      if (result.success && result.data) {
        setGroups(result.data);
      } else {
        console.error('Failed to load credential groups:', result.error);
      }
    } catch (err) {
      console.error('Failed to load credential groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const createGroup = useCallback(
    async (data: CreateCredentialGroupData): Promise<CredentialGroup | null> => {
      try {
        const result = await window.api.credentialGroups.create(data);
        if (result.success && result.data) {
          await refreshGroups();
          return result.data;
        }
        console.error('Failed to create credential group:', result.error);
        return null;
      } catch (err) {
        console.error('Failed to create credential group:', err);
        return null;
      }
    },
    [refreshGroups]
  );

  const updateGroup = useCallback(
    async (id: string, data: UpdateCredentialGroupData): Promise<CredentialGroup | null> => {
      try {
        const result = await window.api.credentialGroups.update(id, data);
        if (result.success && result.data) {
          await refreshGroups();
          return result.data;
        }
        console.error('Failed to update credential group:', result.error);
        return null;
      } catch (err) {
        console.error('Failed to update credential group:', err);
        return null;
      }
    },
    [refreshGroups]
  );

  const deleteGroup = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const result = await window.api.credentialGroups.delete(id);
        if (result.success) {
          await refreshGroups();
          return true;
        }
        console.error('Failed to delete credential group:', result.error);
        return false;
      } catch (err) {
        console.error('Failed to delete credential group:', err);
        return false;
      }
    },
    [refreshGroups]
  );

  return {
    groups,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    refreshGroups,
  };
}
