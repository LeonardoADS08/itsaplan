'use client';

import { useTranslations } from 'next-intl';
import { useCreateTeam } from '@/services/teams.service';
import TeamNameModal from './TeamNameModal';

// Creates a team with the current user as its owner. Name only: everything else a
// team carries (its members, its projects) is added afterwards.
export default function NewTeamModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('teams.create');
  const createTeam = useCreateTeam();

  return (
    <TeamNameModal
      title={t('title')}
      placeholder={t('namePlaceholder')}
      hint={t('hint')}
      submitLabel={t('submit')}
      busy={createTeam.isPending}
      onSubmit={(name) => createTeam.mutate({ name }, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}
