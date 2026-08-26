'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamIntegrationsTab from './integrations/TeamIntegrationsTab';
import TeamNotificationsTab from './notifications/TeamNotificationsTab';
import TeamRolesTab from './roles/TeamRolesTab';

type PanelTab = 'roles' | 'notifications' | 'integrations';

// What the team configures for every project it owns: the roles they assign from,
// the providers they deliver notifications through, and the integration credentials
// their agents and tools run on. The first two are owner-only, so a plain member sees
// a notice inside; the credentials also open to a member whose project role grants
// them.
export default function TeamPanelTabs({
  teamId,
  teamName,
  canManage,
  integrationPermissions,
  onEditorOpenChange,
}: {
  teamId: number;
  teamName: string;
  canManage: boolean;
  integrationPermissions: ResourcePermissions;
  onEditorOpenChange: (open: boolean) => void;
}) {
  const tRoles = useTranslations('teams.roles');
  const tNotifications = useTranslations('teams.notifications');
  const tIntegrations = useTranslations('teams.integrations');
  const [tab, setTab] = useState<PanelTab>('roles');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as PanelTab)} className="flex flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="roles">{tRoles('title')}</TabsTrigger>
        <TabsTrigger value="notifications">{tNotifications('title')}</TabsTrigger>
        <TabsTrigger value="integrations">{tIntegrations('title')}</TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="mt-0">
        <TeamRolesTab
          teamId={teamId}
          teamName={teamName}
          canManage={canManage}
          onEditorOpenChange={onEditorOpenChange}
        />
      </TabsContent>

      <TabsContent value="notifications" className="mt-0">
        <TeamNotificationsTab teamId={teamId} canManage={canManage} />
      </TabsContent>

      <TabsContent value="integrations" className="mt-0">
        <TeamIntegrationsTab teamId={teamId} permissions={integrationPermissions} />
      </TabsContent>
    </Tabs>
  );
}
