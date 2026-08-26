'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api';
import { useTeamIntegrationCatalogQuery } from '@/services/integrations.service';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CredentialDialog } from './CredentialDialog';
import TeamIntegrations from './TeamIntegrations';

// The integrations tab of the team panel: the API keys of AI providers and the
// credentials of tool integrations, shared by every project the team owns. Secrets
// are write-only, so the list shows only a masked view.
export default function TeamIntegrationsTab({
  teamId,
  permissions,
}: {
  teamId: number;
  permissions: ResourcePermissions;
}) {
  const t = useTranslations('teams.integrations');
  // The catalog names the integrations and builds the credential form, so it is
  // fetched for anyone who may read or add a credential.
  const canSee = permissions.read || permissions.create;
  const catalog = useTeamIntegrationCatalogQuery(canSee ? teamId : null).data ?? [];
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        {permissions.create && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto size-7 text-muted-foreground hover:text-foreground"
                aria-label={t('add')}
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('add')}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {!permissions.read ? (
        <p className="text-sm text-muted-foreground">{t('noAccess')}</p>
      ) : (
        <TeamIntegrations teamId={teamId} catalog={catalog} permissions={permissions} />
      )}

      {creating && (
        <CredentialDialog
          teamId={teamId}
          catalog={catalog}
          existing={null}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}
