'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api';
import { usePermissionCatalogQuery, useTeamRolesQuery } from '@/services/roles.service';
import RoleEditorPanel from './RoleEditorPanel';
import TeamRolesList from './TeamRolesList';
import TeamRolesToolbar from './TeamRolesToolbar';

// The roles tab of the team panel: the roles every project of the team assigns
// from, with the editor they are created and changed in. Only the team owner manages
// them, so anyone else reads a notice instead of the list. The editor is a panel of
// its own over this one, which is why the team panel is told when it is open — it
// must not take Escape while it is.
export default function TeamRolesTab({
  teamId,
  teamName,
  canManage,
  onEditorOpenChange,
}: {
  teamId: number;
  teamName: string;
  canManage: boolean;
  onEditorOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('teams.roles');
  const rolesQuery = useTeamRolesQuery(canManage ? teamId : null);
  const catalogQuery = usePermissionCatalogQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const roles = rolesQuery.data ?? [];
  const catalog = catalogQuery.data ?? null;
  const editorOpen = creating || editing !== null;

  useEffect(() => {
    onEditorOpenChange(editorOpen);
  }, [editorOpen, onEditorOpenChange]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        {canManage && (
          <TeamRolesToolbar
            teamId={teamId}
            roles={roles}
            catalog={catalog}
            onCreate={() => setCreating(true)}
          />
        )}
      </div>
      {!canManage ? (
        <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
      ) : (
        <TeamRolesList
          teamId={teamId}
          roles={roles}
          pending={rolesQuery.isPending}
          canEdit={catalog !== null}
          onEdit={setEditing}
        />
      )}

      {editorOpen && catalog && (
        <RoleEditorPanel
          teamId={teamId}
          teamName={teamName}
          role={editing}
          catalog={catalog}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
