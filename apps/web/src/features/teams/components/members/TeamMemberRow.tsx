'use client';

import type { TeamMember } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { TableCell, TableRow } from '@/components/ui/table';
import TeamMemberRoleControl from './TeamMemberRoleControl';

// One row of the team member list. An agent is a member like a person, with two
// differences: it is addressed by its handle rather than an email, and the role column
// names the team role it acts under, not its standing in the team. `onOpen` is set for
// an agent the reader may open, which takes them to its settings.
export default function TeamMemberRow({
  member,
  teamId,
  viewerRole,
  self,
  onOpen,
}: {
  member: TeamMember;
  teamId: number;
  viewerRole: TeamMember['role'];
  self: boolean;
  onOpen?: () => void;
}) {
  const displayName = member.name || member.email;
  const isAgent = member.agentId != null;

  return (
    <TableRow className={onOpen ? 'cursor-pointer' : 'hover:bg-transparent'} onClick={onOpen}>
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {isAgent ? `@${member.username}` : member.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <TeamMemberRoleControl
          teamId={teamId}
          member={member}
          viewerRole={viewerRole}
          self={self}
        />
      </TableCell>
      <TableCell className="px-3 py-3 text-sm text-muted-foreground">
        {formatDate(member.joinedAt)}
      </TableCell>
      <TableCell className="px-3 py-3" />
    </TableRow>
  );
}
