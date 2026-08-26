'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamNotificationsTab from './notifications/TeamNotificationsTab';
import TeamRolesTab from './roles/TeamRolesTab';

type PanelTab = 'roles' | 'notifications';

// What the team owner configures for every project the team owns: the roles they
// assign from and the providers they deliver notifications through. Both are
// owner-only, so a plain member sees the tabs with a notice inside.
export default function TeamPanelTabs({
  teamId,
  teamName,
  canManage,
  onEditorOpenChange,
}: {
  teamId: number;
  teamName: string;
  canManage: boolean;
  onEditorOpenChange: (open: boolean) => void;
}) {
  const tRoles = useTranslations('teams.roles');
  const tNotifications = useTranslations('teams.notifications');
  const [tab, setTab] = useState<PanelTab>('roles');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as PanelTab)} className="flex flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="roles">{tRoles('title')}</TabsTrigger>
        <TabsTrigger value="notifications">{tNotifications('title')}</TabsTrigger>
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
    </Tabs>
  );
}
