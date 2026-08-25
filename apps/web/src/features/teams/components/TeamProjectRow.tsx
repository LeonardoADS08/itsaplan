'use client';

import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api';
import { projectPath } from '@/utils/paths';
import DisclosureCard from '@/components/common/DisclosureCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TeamProjectDetail from './TeamProjectDetail';

// One project of the team, opening to the people who can reach it. A project the
// caller belongs to also links into it: a team member sees every project of the
// team but only opens the ones they are a member of.
export default function TeamProjectRow({
  teamId,
  project,
}: {
  teamId: number;
  project: TeamProject;
}) {
  const t = useTranslations('teams.panel');

  return (
    <DisclosureCard
      header={
        <>
          <Badge
            variant="outline"
            className="w-12 shrink-0 rounded px-1 py-0 font-mono text-[10px] text-muted-foreground"
          >
            {project.key}
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{project.name}</span>
            {project.description && (
              <span className="block truncate text-xs text-muted-foreground">
                {project.description}
              </span>
            )}
          </span>
          <span
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
            title={t('memberCount', { count: project.memberCount })}
          >
            <Users className="size-3.5" />
            <span className="tabular-nums">{project.memberCount}</span>
          </span>
        </>
      }
      trailing={
        project.isMember && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="me-1 size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('openProject')}
            title={t('openProject')}
          >
            <Link href={projectPath(project.key)}>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        )
      }
    >
      <TeamProjectDetail teamId={teamId} projectId={project.id} />
    </DisclosureCard>
  );
}
