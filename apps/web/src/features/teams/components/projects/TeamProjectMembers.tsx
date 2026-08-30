'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MemberKind } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTeamProjectMembersQuery } from '@/services/teams.service';
import { usePermissionCatalogQuery, useTeamRolesQuery } from '@/services/roles.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import SearchInput from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TeamProjectMemberCard from './TeamProjectMemberCard';

const PAGE_SIZE = 25;
// A shorter term matches most of the project, so the list stays unfiltered until the
// reader has typed enough for the result to mean something.
const MIN_SEARCH = 3;

// Who can reach one project of the team, a page at a time. The search runs on the
// server, so it reaches the members the current page does not hold.
export default function TeamProjectMembers({
  teamId,
  projectId,
  projectKey,
  ownerCount,
  viewerId,
  canEdit,
  canDelete,
}: {
  teamId: number;
  projectId: number;
  projectKey: string;
  ownerCount: number;
  viewerId: string | undefined;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('teams.panel');
  const tMembers = useTranslations('members');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<MemberKind>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const debounced = useDebouncedValue(search.trim(), 300);
  const term = debounced.length >= MIN_SEARCH ? debounced : undefined;

  const membersQuery = useTeamProjectMembersQuery(teamId, projectId, {
    search: term,
    kind,
    limit,
    offset: 0,
  });
  // The roles carry the matrix each membership resolves to, so they are fetched for
  // every reader of the panel, not only the one who may reassign them.
  const rolesQuery = useTeamRolesQuery(teamId);
  const catalogQuery = usePermissionCatalogQuery();

  const members = membersQuery.data?.items ?? [];
  const total = membersQuery.data?.total ?? 0;

  function onSearchChange(value: string) {
    setSearch(value);
    setLimit(PAGE_SIZE);
  }

  function onKindChange(value: string) {
    setKind(value as MemberKind);
    setLimit(PAGE_SIZE);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{t('projectMembers')}</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">{total}</span>}
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={t('searchMembers')}
          className="min-w-0 flex-1"
        />
        <Select value={kind} onValueChange={onKindChange}>
          <SelectTrigger className="h-9 w-[150px]" aria-label={tMembers('tabs.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tMembers('tabs.all')}</SelectItem>
            <SelectItem value="human">{tMembers('tabs.people')}</SelectItem>
            <SelectItem value="agent">{tMembers('tabs.agents')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {membersQuery.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : members.length === 0 ? (
        <EmptyState
          title={t('noMembersTitle')}
          description={term || kind !== 'all' ? t('noMemberMatches') : t('noProjectMembers')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {members.map((member) => (
              <TeamProjectMemberCard
                key={member.userId}
                projectKey={projectKey}
                member={member}
                roles={rolesQuery.data ?? []}
                catalog={catalogQuery.data}
                self={member.userId === viewerId}
                isLastOwner={member.role === 'owner' && ownerCount === 1}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
          {members.length < total && (
            <Button
              variant="outline"
              className="w-full"
              disabled={membersQuery.isFetching}
              onClick={() => setLimit(limit + PAGE_SIZE)}
            >
              {tCommon('showMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
