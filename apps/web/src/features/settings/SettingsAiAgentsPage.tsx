'use client';

import { useShell } from '@/context/shellContext';
import { AI_AGENTS_SECTION } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import ProjectAiAgents from './components/ai-agents/ProjectAiAgents';

const section = AI_AGENTS_SECTION;

// The AI agents page (/project/:projectKey/ai-agents), a top-level nav item. The team
// owns its agents, so this page only lists the ones working in the project; managing
// them is the team's Agents section.
export default function SettingsAiAgentsPage() {
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView title={sectionText.label} description={sectionText.description} wide>
      <RequirePermission resource={section.resource} action="read">
        <ProjectAiAgents />
      </RequirePermission>
    </SectionPageView>
  );
}
