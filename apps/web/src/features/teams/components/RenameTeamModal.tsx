'use client';

import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { useRenameTeam } from '@/services/teams.service';
import TeamNameModal from './TeamNameModal';

// Renames a team the caller owns. The name is all a team carries, so this is the
// only edit its owner has.
export default function RenameTeamModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const t = useTranslations('teams.rename');
  const renameTeam = useRenameTeam();

  return (
    <TeamNameModal
      title={t('title')}
      placeholder={t('namePlaceholder')}
      submitLabel={t('submit')}
      initialName={team.name}
      busy={renameTeam.isPending}
      onSubmit={(name) => renameTeam.mutate({ teamId: team.id, name }, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}
