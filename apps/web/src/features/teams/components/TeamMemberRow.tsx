'use client';

import { useTranslations } from 'next-intl';
import type { TeamMember } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';

export default function TeamMemberRow({ member }: { member: TeamMember }) {
  const t = useTranslations('teams.panel');
  const tManage = useTranslations('teams.manage');
  const displayName = member.name || member.email;

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5">
      <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 font-normal">
        {tManage(`roles.${member.role}`)}
      </Badge>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t('joined', { date: formatDate(member.joinedAt) })}
      </span>
    </div>
  );
}
