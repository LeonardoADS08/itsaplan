'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Permissions } from '@/lib/api';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import DisclosureCard from '@/components/common/DisclosureCard';
import PermissionMatrix from './PermissionMatrix';

// One membership, from either side of it: a project the user can reach, or a member
// of the project. `header` is what the row states about that side, `trailing` the
// controls that act on it; the matrix behind the toggle spells the access out per
// resource.
export default function AccessCard({
  header,
  trailing,
  isOwner,
  roleName,
  permissions,
  catalog,
}: {
  header: ReactNode;
  trailing?: ReactNode;
  isOwner: boolean;
  roleName: string | null;
  permissions: Permissions | undefined;
  catalog: PermissionCatalog | undefined;
}) {
  const t = useTranslations('permissions.source');

  // Where the permissions on show come from, in words. An owner bypasses the matrix
  // entirely, so its rows are all on and this says why.
  function permissionSource(): string {
    if (isOwner) return t('owner');
    if (roleName) return t('role', { role: roleName });
    return t('default');
  }

  return (
    <DisclosureCard header={header} trailing={trailing}>
      <p className="mb-2 text-xs text-muted-foreground">{permissionSource()}</p>
      {catalog && permissions ? (
        <PermissionMatrix catalog={catalog} permissions={permissions} />
      ) : (
        <ListSkeleton rows={3} rowClassName="h-6" />
      )}
    </DisclosureCard>
  );
}
