'use client';

import { TableCell, TableRow } from '@/components/ui/table';

// The heading over one group of the member list — the people, then the agents — with
// how many it holds. Shown only when the list has both, where a heading tells them
// apart; a team with people alone reads as one list.
export default function TeamMemberGroupRow({ label, first }: { label: string; first?: boolean }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={4}
        className={`px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase ${first ? 'pt-1' : 'pt-5'}`}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}
