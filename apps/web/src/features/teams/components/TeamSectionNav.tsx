'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookText,
  Bot,
  ChevronRight,
  FolderKanban,
  Info,
  Plug,
  Radio,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { cn } from '@/lib/utils';
import { teamSectionPath, type TeamSection } from '@/utils/paths';
import {
  SectionNav,
  sectionNavIdleClass,
  sectionNavItemClass,
  type SectionNavItem,
} from '@/components/common/page/SectionNav';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// The sections of the open team, as the page's second rail: the team itself, its
// projects and members, the roles they assign from, what MCP clients reach, and the
// AI group — the integration credentials the agents run on, the agents themselves,
// the skills they load and the tools they can call — with the notification providers
// last. The counts come with the team list, so each is shown before its section is
// opened.
export default function TeamSectionNav({ team }: { team: Team }) {
  const t = useTranslations('teams.sections');
  const tNav = useTranslations('nav');
  const pathname = usePathname();

  function section(
    id: TeamSection,
    label: string,
    icon: LucideIcon,
    count?: number,
  ): SectionNavItem {
    return {
      id,
      label,
      icon,
      badge: count === undefined ? undefined : String(count),
      href: teamSectionPath(team.id, id),
    };
  }

  const top = [
    section('info', t('info.title'), Info),
    section('projects', t('projects.title'), FolderKanban, team.projectCount),
    section('members', t('members.title'), Users, team.memberCount),
    section('roles', t('roles.title'), ShieldCheck, team.roleCount),
    section('mcp', t('mcp.title'), Radio),
  ];
  const ai = [
    section('integrations', t('integrations.title'), Plug, team.integrationCount),
    section('ai-agents', t('agents.title'), Bot, team.agentCount),
    section('agent-skills', t('agentSkills.title'), BookText, team.skillCount),
    section('agent-tools', t('agentTools.title'), Wrench, team.toolCount),
  ];
  const bottom = [section('notifications', t('notifications.title'), Bell)];

  const activeId = [...top, ...ai, ...bottom].find((entry) => entry.href === pathname)?.id ?? null;
  const aiActive = ai.some((entry) => entry.id === activeId);
  // Null until the user opens or closes the group themselves; until then it follows
  // whichever section is open.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const aiOpen = toggled ?? aiActive;

  return (
    <div className="space-y-2">
      <h2 className="truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {team.name}
      </h2>
      <div className="space-y-0.5">
        <SectionNav sections={top} activeId={activeId} label={team.name} />
        <Collapsible open={aiOpen} onOpenChange={setToggled}>
          <CollapsibleTrigger className={cn(sectionNavItemClass, sectionNavIdleClass)}>
            <Bot className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{tNav('aiTeam')}</span>
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                aiOpen && 'rotate-90',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="ps-4">
            <SectionNav sections={ai} activeId={activeId} label={tNav('aiTeam')} />
          </CollapsibleContent>
        </Collapsible>
        <SectionNav sections={bottom} activeId={activeId} label={team.name} />
      </div>
    </div>
  );
}
