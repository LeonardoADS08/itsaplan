'use client';

import { LogOut, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import RowAction from '@/components/common/RowAction';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// The last owner of a team has nobody to hand it over to, so leaving it is not
// offered — the API rejects it too.
function isLastOwner(team: Team): boolean {
  return team.role === 'owner' && team.ownerCount === 1;
}

export default function ManageTeamsList({
  teams,
  isPending,
  onSelect,
  onRename,
  onLeave,
}: {
  teams: Team[];
  isPending: boolean;
  onSelect: (team: Team) => void;
  onRename: (team: Team) => void;
  onLeave: (team: Team) => void;
}) {
  const t = useTranslations('teams.manage');

  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (teams.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <Table className="mt-2 min-w-[640px] table-fixed">
      <colgroup>
        <col className="w-[34%]" />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[16%]" />
        <col className="w-[12%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.team')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.role')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.members')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.projects')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.joined')}
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            {t('columns.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="group/item cursor-pointer"
            onClick={() => onSelect(team)}
          >
            <TableCell className="px-3 py-3 align-top">
              <p className="truncate text-sm font-medium">{team.name}</p>
            </TableCell>
            <TableCell className="px-3 py-3 align-top">
              <Badge variant="secondary" className="font-normal">
                {t(`roles.${team.role}`)}
              </Badge>
            </TableCell>
            <TableCell className="px-3 py-3 align-top text-sm tabular-nums">
              {team.memberCount}
            </TableCell>
            <TableCell className="px-3 py-3 align-top text-sm tabular-nums">
              {team.projectCount}
            </TableCell>
            <TableCell className="px-3 py-3 align-top text-sm">
              {formatDate(team.joinedAt)}
            </TableCell>
            <TableCell className="px-3 py-2 align-top">
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {team.role === 'owner' && (
                  <RowAction
                    icon={Pencil}
                    label={t('renameAction')}
                    onClick={() => onRename(team)}
                  />
                )}
                {!isLastOwner(team) && (
                  <RowAction
                    icon={LogOut}
                    label={t('leaveAction')}
                    destructive
                    onClick={() => onLeave(team)}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
