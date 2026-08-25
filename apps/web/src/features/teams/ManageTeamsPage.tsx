'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { useTeamsQuery } from '@/services/teams.service';
import FullPageView from '@/components/common/page/FullPageView';
import ManageTeamsList from './components/ManageTeamsList';
import RenameTeamModal from './components/RenameTeamModal';
import TeamDetailPanel from './components/TeamDetailPanel';
import TeamLeaveDialog from './components/TeamLeaveDialog';

// The teams the account belongs to. A row opens the team's panel; an owner
// renames a team, and a member leaves one unless they are its last owner.
export default function ManageTeamsPage() {
  const t = useTranslations('teams.manage');
  const { data: teams, isPending } = useTeamsQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<Team | null>(null);
  const [leaving, setLeaving] = useState<Team | null>(null);

  return (
    <FullPageView label={t('label')} title={t('title')} description={t('description')}>
      <ManageTeamsList
        teams={teams ?? []}
        isPending={isPending}
        onSelect={(team) => setSelected(team.id)}
        onRename={setRenaming}
        onLeave={setLeaving}
      />

      {selected !== null && <TeamDetailPanel teamId={selected} onClose={() => setSelected(null)} />}

      {renaming && <RenameTeamModal team={renaming} onClose={() => setRenaming(null)} />}

      {leaving && <TeamLeaveDialog team={leaving} onClose={() => setLeaving(null)} />}
    </FullPageView>
  );
}
