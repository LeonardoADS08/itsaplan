'use client';

import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { useLeaveTeam } from '@/services/teams.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function TeamLeaveDialog({ team, onClose }: { team: Team; onClose: () => void }) {
  const t = useTranslations('teams.leaveDialog');
  const leaveTeam = useLeaveTeam();

  return (
    <ConfirmDialog
      title={t('title', { name: team.name })}
      confirmLabel={t('confirm')}
      onClose={onClose}
      onConfirm={async () => {
        await leaveTeam.mutateAsync(team.id);
        onClose();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t.rich('description', {
          name: team.name,
          strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
      </p>
    </ConfirmDialog>
  );
}
