'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { useTeamQuery } from '@/services/teams.service';
import { AI_AGENTS_SECTION } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { AgentSectionProvider } from '../../context/agentSection';
import { TeamAiAgentSheet } from './TeamAiAgentSheet';
import ProjectAiAgents from './ProjectAiAgents';

const section = AI_AGENTS_SECTION;

// The AI agents page (/project/:projectKey/ai-agents), a top-level nav item. It lists
// the agents working in the project; an agent belongs to the team, so creating and
// editing one is gated by the team's agent permissions and uses the team's sheet.
export default function ProjectAiAgentsSection() {
  const { project } = useShell();
  if (!project) return null;
  return <AgentsSection teamId={project.project.teamId} projectId={project.project.id} />;
}

function AgentsSection({ teamId, projectId }: { teamId: number; projectId: number }) {
  const t = useTranslations('teams.agents');
  const sectionText = useSettingsSectionText()(section.slug);
  const permissions = useTeamQuery(teamId).data?.permissions.ai_agents;
  const [creating, setCreating] = useState(false);

  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      actions={
        permissions?.create ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('newAgent')}
          </Button>
        ) : undefined
      }
    >
      <RequirePermission resource={section.resource} action="read">
        {!permissions ? (
          <ListSkeleton rows={3} rowClassName="h-12" />
        ) : (
          <AgentSectionProvider teamId={teamId} permissions={permissions}>
            <ProjectAiAgents />
            <TeamAiAgentSheet
              open={creating}
              agent={null}
              defaultProjectId={projectId}
              onClose={() => setCreating(false)}
            />
          </AgentSectionProvider>
        )}
      </RequirePermission>
    </SectionPageView>
  );
}
