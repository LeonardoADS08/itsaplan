'use client';

import { useTranslations } from 'next-intl';
import type { TeamProject, TeamRole } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { useTeamProjectQuery } from '@/services/teams.service';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import MemberAccessCard from '@/components/common/permissions/MemberAccessCard';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import TeamProjectActions from './TeamProjectActions';
import TeamProjectStats from './TeamProjectStats';

// How one project of the team is doing and who can reach it. Mounted by the project
// row when it opens, so the request is made for the project the reader asked about
// and no other.
export default function TeamProjectDetail({
  teamId,
  teamRole,
  project,
}: {
  teamId: number;
  teamRole: TeamRole;
  project: TeamProject;
}) {
  const t = useTranslations('teams.panel');
  const { data: detail } = useTeamProjectQuery(teamId, project.id);
  const catalogQuery = usePermissionCatalogQuery();

  if (!detail) return <ListSkeleton rows={3} rowClassName="h-10" />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium">{t('info')}</h4>
          <div className="ms-auto">
            <TeamProjectActions
              teamId={teamId}
              teamRole={teamRole}
              project={project}
              members={detail.members}
            />
          </div>
        </div>
        {project.description && (
          <p dir="auto" className="text-xs text-foreground">
            {project.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t('lastActivity', {
            value: detail.lastActivityAt ? formatDateTime(detail.lastActivityAt) : t('noActivity'),
          })}
        </p>
        <TeamProjectStats stats={detail.stats} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-xs font-medium">{t('projectMembers')}</h4>
          <span className="text-xs text-muted-foreground">{detail.members.length}</span>
        </div>
        {detail.members.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noProjectMembers')}</p>
        ) : (
          <div className="space-y-2">
            {detail.members.map((member) => (
              <MemberAccessCard key={member.userId} member={member} catalog={catalogQuery.data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
