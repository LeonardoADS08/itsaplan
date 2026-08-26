'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/utils/dates';
import { projectPath } from '@/utils/paths';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { useTeamQuery } from '@/services/teams.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import NewProjectModal from '@/components/layout/NewProjectModal';
import TeamMembersSection from './TeamMembersSection';
import TeamPanelTabs from './TeamPanelTabs';
import TeamProjectRow from './TeamProjectRow';

// One team in a right-hand side panel: what it configures for every project it owns
// (the roles they assign from, the providers they deliver notifications through, the
// integration credentials their agents run on), the projects themselves, and its
// members with the invites waiting to be answered. Escape or a backdrop click closes
// it.
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
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  // The role editor is a panel over this one, so it takes Escape while it is open.
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  // Owners and managers run the team's projects; a plain member only reads them.
  const canCreateProject = !!team && team.role !== 'member';
  // Roles decide what a member of any project of the team may do, and the providers
  // carry credentials, so only the owner manages either.
  const isOwner = team?.role === 'owner';

  useExitOnEscape(onClose, !roleEditorOpen);

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
              <TeamPanelTabs
                teamId={team.id}
                teamName={team.name}
                canManage={isOwner}
                integrationPermissions={team.permissions.integrations}
                onEditorOpenChange={setRoleEditorOpen}
              />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{t('projects')}</h3>
                  <span className="text-xs text-muted-foreground">{team.projectCount}</span>
                  {canCreateProject && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ms-auto size-7 text-muted-foreground hover:text-foreground"
                          aria-label={t('newProject')}
                          onClick={() => setCreating(true)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('newProject')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {team.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
                ) : (
                  <div className="space-y-2">
                    {team.projects.map((project) => (
                      <TeamProjectRow
                        key={project.id}
                        teamId={team.id}
                        teamRole={team.role}
                        project={project}
                      />
                    ))}
                  </div>
                )}
              </section>

              <TeamMembersSection team={team} />
            </>
          )}
        </div>
      </div>

      {creating && (
        <NewProjectModal
          teamId={teamId}
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            router.push(projectPath(key));
          }}
        />
      )}
    </div>
  );
}
