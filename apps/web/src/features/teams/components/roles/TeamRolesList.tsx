'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteRole } from '@/services/roles.service';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';

// The team's roles, one row each: what it grants, and the actions to edit or delete
// it. The default role cannot be deleted; members on a deleted one fall back to it.
export default function TeamRolesList({
  teamId,
  roles,
  pending,
  canEdit,
  onEdit,
}: {
  teamId: number;
  roles: Role[];
  pending: boolean;
  canEdit: boolean;
  onEdit: (role: Role) => void;
}) {
  const t = useTranslations('teams.roles');
  const deleteRole = useDeleteRole(teamId);
  const [deleting, setDeleting] = useState<Role | null>(null);

  if (pending) return <ListSkeleton rows={2} rowClassName="h-12" />;
  if (roles.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  return (
    <div className="space-y-2">
      {roles.map((role) => (
        <div
          key={role.id}
          className="flex min-h-10 items-center gap-2.5 overflow-hidden rounded-lg bg-muted/30 pe-1"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch px-3 text-start transition-colors hover:bg-muted/70 disabled:hover:bg-transparent"
            disabled={!canEdit}
            aria-label={t('editAction')}
            onClick={() => onEdit(role)}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{role.name}</span>
            {role.isDefault && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                {t('default')}
              </Badge>
            )}
          </button>
          <PermissionsPopover permissions={role.permissions} />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={role.isDefault}
                  aria-label={t('deleteAction')}
                  onClick={() => setDeleting(role)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {role.isDefault ? t('defaultUndeletable') : t('deleteAction')}
            </TooltipContent>
          </Tooltip>
        </div>
      ))}

      {deleting && (
        <ConfirmDialog
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('deleteAction')}
          onConfirm={async () => {
            await deleteRole.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">{t('deleteDescription')}</div>
        </ConfirmDialog>
      )}
    </div>
  );
}
