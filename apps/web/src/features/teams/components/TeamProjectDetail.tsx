'use client';

import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/utils/dates';
import { useTeamProjectQuery } from '@/services/teams.service';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import MemberAccessCard from '@/components/common/permissions/MemberAccessCard';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import TeamProjectStats from './TeamProjectStats';

// How one project of the team is doing and who can reach it. Mounted by the project
// row when it opens, so the request is made for the project the reader asked about
// and no other.
export default function TeamProjectDetail({
  teamId,
  projectId,
}: {
  teamId: number;
  projectId: number;
}) {
  const t = useTranslations('teams.panel');
  const { data: project } = useTeamProjectQuery(teamId, projectId);
  const catalogQuery = usePermissionCatalogQuery();

  if (!project) return <ListSkeleton rows={3} rowClassName="h-10" />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {t('lastActivity', {
            value: project.lastActivityAt
              ? formatDateTime(project.lastActivityAt)
              : t('noActivity'),
          })}
        </p>
        <TeamProjectStats stats={project.stats} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-xs font-medium">{t('projectMembers')}</h4>
          <span className="text-xs text-muted-foreground">{project.members.length}</span>
        </div>
        {project.members.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noProjectMembers')}</p>
        ) : (
          <div className="space-y-2">
            {project.members.map((member) => (
              <MemberAccessCard key={member.userId} member={member} catalog={catalogQuery.data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
