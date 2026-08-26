'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { useRenameTeam, useTeam } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TeamLeaveDialog from './TeamLeaveDialog';

// The last owner of a team has nobody to hand it over to, so leaving it is not
// offered — the API rejects it too.
function isLastOwner(team: Team): boolean {
  return team.role === 'owner' && team.ownerCount === 1;
}

// The team itself: the name its owner edits here, the caller's rank in it, and the
// way out of it. Everything it shows comes with the team list.
export default function TeamInfoSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.info');
  const tSection = useTranslations('teams.sections.info');
  const tManage = useTranslations('teams.manage');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const renameTeam = useRenameTeam();
  const [draft, setDraft] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (!team) return <PageSkeleton rows={3} className="max-w-[60%] min-w-[600px]" />;

  const name = draft ?? team.name;
  const isOwner = team.role === 'owner';
  const trimmed = name.trim();
  const canSave = isOwner && trimmed !== '' && trimmed !== team.name && !renameTeam.isPending;

  async function save() {
    await renameTeam.mutateAsync({ teamId, name: trimmed });
    setDraft(null);
    toast.success(t('saved'));
  }

  return (
    <SectionPageView
      title={tSection('title')}
      description={tSection('description')}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        isOwner ? (
          <Button size="sm" className="h-8" disabled={!canSave} onClick={() => void save()}>
            {tCommon('save')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-10">
        <SettingsSection title={t('team')} description={t('teamHint')}>
          <SettingsCard className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">{tCommon('name')}</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!isOwner}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('role')}</Label>
              <Badge variant="secondary" className="font-normal">
                {tManage(`roles.${team.role}`)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('created')}</Label>
              <span className="text-sm text-muted-foreground">{formatDate(team.createdAt)}</span>
            </div>
          </SettingsCard>
        </SettingsSection>

        {!isLastOwner(team) && (
          <SettingsSection
            title={tManage('leaveAction')}
            description={t('leaveHint')}
            action={
              <Button variant="outline" size="sm" className="h-8" onClick={() => setLeaving(true)}>
                {tManage('leaveAction')}
              </Button>
            }
          />
        )}
      </div>

      {leaving && <TeamLeaveDialog team={team} onClose={() => setLeaving(false)} />}
    </SectionPageView>
  );
}
