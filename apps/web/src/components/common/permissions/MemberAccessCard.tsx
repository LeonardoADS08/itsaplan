'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Permissions } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import AccessCard from './AccessCard';

// One member of a project, with the access their membership resolves to behind the
// toggle. Rendered wherever a project's member list is shown: the instance project
// panel and the team panel.
export default function MemberAccessCard({
  member,
  catalog,
}: {
  member: {
    name: string;
    email: string;
    username: string | null;
    image: string | null;
    isAgent: boolean;
    role: 'owner' | 'member';
    roleName: string | null;
    permissions: Permissions;
  };
  catalog: PermissionCatalog | undefined;
}) {
  const tCommon = useTranslations('common');
  const isOwner = member.role === 'owner';
  const displayName = member.name || member.email;

  // Under the name: the address for a person, the handle for an agent, whose address
  // is internal to the instance. Nothing when the name line already carries it.
  function secondaryLine(): string | null {
    if (member.isAgent) return member.username ? `@${member.username}` : null;
    return member.name ? member.email : null;
  }
  const secondary = secondaryLine();

  return (
    <AccessCard
      isOwner={isOwner}
      roleName={member.roleName}
      permissions={member.permissions}
      catalog={catalog}
      header={
        <>
          <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              {member.isAgent && (
                <Bot
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={tCommon('agent')}
                />
              )}
              <span className="truncate text-sm">{displayName}</span>
            </span>
            {secondary && (
              <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
            )}
          </span>
          <Badge
            variant={isOwner ? 'default' : 'secondary'}
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {isOwner ? tCommon('owner') : (member.roleName ?? tCommon('member'))}
          </Badge>
        </>
      }
    />
  );
}
