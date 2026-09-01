'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DatabaseBackup } from 'lucide-react';
import type { WhatsNew } from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import TakeoverScreen, { type TakeoverSection } from '@/components/common/page/TakeoverScreen';
import WhatsNewBackup from './WhatsNewBackup';
import WhatsNewMigrationReport from './WhatsNewMigrationReport';

// What the release brought, then — for an administrator — the backup taken before its
// migrations and what those migrations changed.
export default function WhatsNewOverlay({
  data,
  onClose,
}: {
  data: WhatsNew;
  onClose: () => void;
}) {
  const t = useTranslations('whatsNew');
  const notes = useMemo(
    () => (data.notes ? renderMarkdown(data.notes, { newTabLinks: true }) : ''),
    [data.notes],
  );

  const sections: TakeoverSection[] = [];
  if (notes) {
    sections.push({
      id: 'notes',
      title: t('notesHeading'),
      body: <div className="md-content max-w-[68ch]" dangerouslySetInnerHTML={{ __html: notes }} />,
    });
  }
  if (data.backup) {
    sections.push({
      id: 'backup',
      title: t('backup.title'),
      icon: <DatabaseBackup className="size-4 text-muted-foreground" />,
      body: <WhatsNewBackup backup={data.backup} />,
    });
  }
  if (data.migration) {
    sections.push({
      id: 'report',
      title: t('report.title'),
      description: t('report.subtitle'),
      body: <WhatsNewMigrationReport report={data.migration} />,
    });
  }

  return (
    <TakeoverScreen
      eyebrow={t('eyebrow')}
      title={t('title', { version: data.version })}
      sections={sections}
      actionLabel={t('done')}
      onAction={onClose}
    />
  );
}
