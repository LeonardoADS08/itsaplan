'use client';

import { useTranslations } from 'next-intl';
import type { TeamMember } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';

export default function TeamMemberRow({ member }: { member: TeamMember }) {
  const tManage = useTranslations('teams.manage');
  const displayName = member.name || member.email;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <Badge variant="secondary" className="font-normal">
          {tManage(`roles.${member.role}`)}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm text-muted-foreground">
        {formatDate(member.joinedAt)}
      </TableCell>
      <TableCell className="px-3 py-3" />
    </TableRow>
  );
}
