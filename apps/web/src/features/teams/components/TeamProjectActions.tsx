'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LogOut, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamProject, TeamProjectMember, TeamRole } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { projectPath } from '@/utils/paths';
import RowAction from '@/components/common/RowAction';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NewProjectModal from '@/components/layout/NewProjectModal';
import TeamProjectDeleteDialog from './TeamProjectDeleteDialog';
import TeamProjectEditModal from './TeamProjectEditModal';
import TeamProjectLeaveDialog from './TeamProjectLeaveDialog';

// What the reader may do with one project of the team. Editing and copying follow
// their rank in the team — a manager does both, an owner also deletes — while
// leaving follows their membership in the project, which its last owner cannot
// give up. The two actions that take access away sit in a menu, out of reach of a
// stray click.
export default function TeamProjectActions({
  teamId,
  teamRole,
  project,
  members,
}: {
  teamId: number;
  teamRole: TeamRole;
  project: TeamProject;
  members: TeamProjectMember[];
}) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const userId = session?.user.id;
  const own = members.find((m) => m.userId === userId);
  const isLastOwner =
    own?.role === 'owner' && members.filter((m) => m.role === 'owner').length === 1;
  const canLeave = !!own && !isLastOwner;
  const canEdit = teamRole !== 'member';
  const canDelete = teamRole === 'owner';

  if (!canEdit && !canLeave) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canEdit && (
        <>
          <RowAction icon={Pencil} label={t('editAction')} onClick={() => setEditing(true)} />
          <RowAction icon={Copy} label={t('copyAction')} onClick={() => setCopying(true)} />
        </>
      )}
      {(canLeave || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={tCommon('more')}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canLeave && (
              <DropdownMenuItem onSelect={() => setLeaving(true)}>
                <LogOut />
                {t('leaveAction')}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 />
                {t('deleteAction')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {editing && (
        <TeamProjectEditModal teamId={teamId} project={project} onClose={() => setEditing(false)} />
      )}

      {copying && (
        <NewProjectModal
          teamId={teamId}
          copyFrom={project}
          onClose={() => setCopying(false)}
          onCreated={(key) => {
            setCopying(false);
            router.push(projectPath(key));
          }}
        />
      )}

      {deleting && (
        <TeamProjectDeleteDialog
          teamId={teamId}
          project={project}
          onClose={() => setDeleting(false)}
        />
      )}

      {leaving && userId && (
        <TeamProjectLeaveDialog
          project={project}
          userId={userId}
          onClose={() => setLeaving(false)}
        />
      )}
    </div>
  );
}
