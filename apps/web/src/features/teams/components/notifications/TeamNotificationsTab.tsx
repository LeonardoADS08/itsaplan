'use client';

import { useTranslations } from 'next-intl';
import { useNotificationSettingsQuery } from '@/services/teams.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import TeamNotificationProviders from './TeamNotificationProviders';

// The notification providers tab of the team panel: the email (SMTP or Resend) and
// Telegram bot credentials every project of the team delivers through. Only the team
// owner reads or changes them, so anyone else gets a notice instead.
export default function TeamNotificationsTab({
  teamId,
  canManage,
}: {
  teamId: number;
  canManage: boolean;
}) {
  const t = useTranslations('teams.notifications');
  const { data } = useNotificationSettingsQuery(canManage ? teamId : null);

  if (!canManage) return <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>;
  if (!data) return <ListSkeleton rows={3} rowClassName="h-12" />;
  return <TeamNotificationProviders teamId={teamId} settings={data} />;
}
