'use client';

import { usePathname } from 'next/navigation';
import {
  Bell,
  BookText,
  FolderKanban,
  Info,
  Plug,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api';
import { teamSectionPath, type TeamSection } from '@/utils/paths';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';

// The sections of the open team, as the page's second rail: the team itself, its
// projects and members, and what it configures for every project it owns — the roles
// they assign from, the integration credentials their agents run on, the skills those
// agents load, and the providers they deliver notifications through. The counts come
// with the team list, so each is shown before its section is opened.
export default function TeamSectionNav({ team }: { team: Team }) {
  const t = useTranslations('teams.sections');
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

  const sections = [
    section('info', t('info.title'), Info),
    section('projects', t('projects.title'), FolderKanban, team.projectCount),
    section('members', t('members.title'), Users, team.memberCount),
    section('roles', t('roles.title'), ShieldCheck, team.roleCount),
    section('integrations', t('integrations.title'), Plug, team.integrationCount),
    section('agent-skills', t('agentSkills.title'), BookText, team.skillCount),
    section('notifications', t('notifications.title'), Bell),
  ];

  const active = sections.find((entry) => entry.href === pathname)?.id ?? null;

  return (
    <div className="space-y-2">
      <h2 className="truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {team.name}
      </h2>
      <SectionNav sections={sections} activeId={active} label={team.name} />
    </div>
  );
}
