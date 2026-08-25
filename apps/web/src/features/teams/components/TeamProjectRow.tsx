'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api';
import { cn } from '@/lib/utils';
import { projectPath } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';

const ROW_CLASS = 'flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5';

// One project of the team. A project the caller belongs to is a link into it;
// the rest are listed as plain rows, since a team member sees every project of
// the team but only opens the ones they are a member of.
export default function TeamProjectRow({ project }: { project: TeamProject }) {
  const t = useTranslations('teams.panel');
  const body = (
    <>
      <Badge variant="secondary" className="shrink-0 font-mono">
        {project.key}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        {project.description && (
          <p className="truncate text-xs text-muted-foreground">{project.description}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t('memberCount', { count: project.memberCount })}
      </span>
    </>
  );

  if (!project.isMember) return <div className={ROW_CLASS}>{body}</div>;

  return (
    <Link href={projectPath(project.key)} className={cn(ROW_CLASS, 'hover:bg-muted/60')}>
      {body}
    </Link>
  );
}
