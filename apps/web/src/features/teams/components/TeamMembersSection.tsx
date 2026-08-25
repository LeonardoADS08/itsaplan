'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteRow, TeamDetail } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteTeamInvite, useTeamInvitesQuery } from '@/services/teams.service';
import TeamInviteDialog from './TeamInviteDialog';
import TeamInviteRow from './TeamInviteRow';
import TeamMemberRow from './TeamMemberRow';

// The team's member list, with the invites that have not been answered yet above it.
// Owners and managers run the list, so only they invite and see the pending invites.
export default function TeamMembersSection({ team }: { team: TeamDetail }) {
  const t = useTranslations('teams.panel');
  const tInvite = useTranslations('teams.invite');
  const canInvite = team.role !== 'member';
  const invitesQuery = useTeamInvitesQuery(team.id, canInvite);
  const deleteInvite = useDeleteTeamInvite(team.id);
  const [inviting, setInviting] = useState(false);
  const [target, setTarget] = useState<InviteRow | null>(null);

  const pending = (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending');

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('teamMembers')}</h3>
        <span className="text-xs text-muted-foreground">{team.memberCount}</span>
        {canInvite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto size-7 text-muted-foreground hover:text-foreground"
                aria-label={tInvite('action')}
                onClick={() => setInviting(true)}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tInvite('action')}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="space-y-2">
        {pending.map((invite) => (
          <TeamInviteRow key={invite.id} invite={invite} onRevoke={setTarget} />
        ))}
        {team.members.map((member) => (
          <TeamMemberRow key={member.userId} member={member} />
        ))}
      </div>

      {inviting && (
        <TeamInviteDialog
          teamId={team.id}
          teamName={team.name}
          teamRole={team.role}
          onClose={() => setInviting(false)}
        />
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
    </section>
  );
}
