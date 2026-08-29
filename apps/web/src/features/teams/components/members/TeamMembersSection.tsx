'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { InviteRow, TeamMember } from '@/lib/api';
import {
  useDeleteTeamInvite,
  useRemoveTeamMember,
  useTeam,
  useTeamInvitesQuery,
  useTeamMembersQuery,
} from '@/services/teams.service';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { teamSectionPath } from '@/utils/paths';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TeamInviteDialog from './TeamInviteDialog';
import TeamInviteRow from './TeamInviteRow';
import TeamMemberRow from './TeamMemberRow';
import TeamMemberGroupRow from './TeamMemberGroupRow';

// The team's members, with the invites that have not been answered yet above them.
// People and agents work on one board, so both are listed, in a group of their own
// each; selecting an agent opens the section that configures it. Owners and managers
// run the list, so only they invite and see the pending invites; only an owner removes
// a person from it.
export default function TeamMembersSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const tInvite = useTranslations('teams.invite');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const { data: members } = useTeamMembersQuery(teamId);
  const canInvite = team != null && team.role !== 'member';
  const invitesQuery = useTeamInvitesQuery(teamId, canInvite);
  const deleteInvite = useDeleteTeamInvite(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const [inviting, setInviting] = useState(false);
  const [target, setTarget] = useState<InviteRow | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const pending = (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending');
  const people = (members ?? []).filter((member) => member.agentId == null);
  const agents = (members ?? []).filter((member) => member.agentId != null);

  return (
    <SectionPageView
      title={t('sections.members.title')}
      description={t('sections.members.description')}
      wide
      actions={
        canInvite ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setInviting(true)}>
            <Plus className="size-3.5" />
            {tInvite('action')}
          </Button>
        ) : undefined
      }
    >
      {!members ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[720px] table-fixed">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.account')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.role')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.joined')}
                </TableHead>
                <TableHead className="text-end text-xs font-medium text-muted-foreground">
                  {tCommon('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((invite) => (
                <TeamInviteRow key={invite.id} invite={invite} onRevoke={setTarget} />
              ))}
              {agents.length > 0 && (
                <TeamMemberGroupRow
                  label={t('members.peopleGroup', { count: people.length })}
                  first
                />
              )}
              {people.map((member) => (
                <TeamMemberRow
                  key={member.userId}
                  member={member}
                  teamId={teamId}
                  viewerRole={team?.role ?? 'member'}
                  self={member.userId === session?.user.id}
                  onRemove={setRemoving}
                />
              ))}
              {agents.length > 0 && (
                <TeamMemberGroupRow label={t('members.agentGroup', { count: agents.length })} />
              )}
              {agents.map((member) => (
                <TeamMemberRow
                  key={member.userId}
                  member={member}
                  teamId={teamId}
                  viewerRole={team?.role ?? 'member'}
                  self={false}
                  onOpen={() => router.push(teamSectionPath(teamId, 'ai-agents'))}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {inviting && team && (
        <TeamInviteDialog
          teamId={teamId}
          teamName={team.name}
          teamRole={team.role}
          onClose={() => setInviting(false)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={t('members.removeTitle', { name: removing.name || removing.email })}
          confirmLabel={t('members.removeConfirm')}
          onConfirm={async () => {
            await removeMember.mutateAsync(removing.userId);
            setRemoving(null);
            toast.success(t('members.removed', { name: removing.name || removing.email }));
          }}
          onClose={() => setRemoving(null)}
        >
          <div className="text-sm text-muted-foreground">{t('members.removeDescription')}</div>
        </ConfirmDialog>
      )}

      {target && (
        <ConfirmDialog
          title={tInvite('revokeTitle', { email: target.email })}
          confirmLabel={tInvite('revokeConfirm')}
          onConfirm={async () => {
            await deleteInvite.mutateAsync(target.id);
            setTarget(null);
          }}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">{tInvite('revokeDescription')}</div>
        </ConfirmDialog>
      )}
    </SectionPageView>
  );
}
