'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import SectionPageView from '@/components/common/page/SectionPageView';
import McpAccessNotice from './components/McpAccessNotice';
import McpConnectionGuide from './components/McpConnectionGuide';

export default function McpServerPage() {
  const t = useTranslations('mcp');
  const { project } = useShell();
  const detail = project?.project ?? null;
  const reachable = detail != null && detail.mcpEnabled && detail.teamMcpEnabled;

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <div className="space-y-10">
        {detail && !reachable && (
          <McpAccessNotice
            teamId={detail.teamId}
            teamName={detail.teamName}
            teamRole={project?.viewer.teamRole ?? null}
            teamMcpEnabled={detail.teamMcpEnabled}
          />
        )}
        <McpConnectionGuide />
      </div>
    </SectionPageView>
  );
}
