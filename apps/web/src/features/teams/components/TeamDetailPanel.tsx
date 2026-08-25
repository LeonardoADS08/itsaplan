'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { useTeamQuery } from '@/services/teams.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TeamMemberRow from './TeamMemberRow';
import TeamProjectRow from './TeamProjectRow';

// One team in a right-hand side panel: the projects it owns and its members.
// Escape or a backdrop click closes it.
export default function TeamDetailPanel({
  teamId,
  onClose,
}: {
  teamId: number;
  onClose: () => void;
}) {
  const t = useTranslations('teams.panel');
  const tManage = useTranslations('teams.manage');
  const tCommon = useTranslations('common');
  const { data: team } = useTeamQuery(teamId);

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-start justify-between gap-3 bg-muted/30 px-6 pt-5 pb-4">
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate text-base font-semibold">
              {team ? team.name : tCommon('loading')}
            </h2>
            {team && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {tManage(`roles.${team.role}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('created', { date: formatDate(team.createdAt) })}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!team ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{t('projects')}</h3>
                  <span className="text-xs text-muted-foreground">{team.projectCount}</span>
                </div>
                {team.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
                ) : (
                  <div className="space-y-2">
                    {team.projects.map((project) => (
                      <TeamProjectRow key={project.id} teamId={team.id} project={project} />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{t('teamMembers')}</h3>
                  <span className="text-xs text-muted-foreground">{team.memberCount}</span>
                </div>
                <div className="space-y-2">
                  {team.members.map((member) => (
                    <TeamMemberRow key={member.userId} member={member} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
