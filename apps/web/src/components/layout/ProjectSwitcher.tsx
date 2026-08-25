import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, Plus, Settings2, SquareKanban, UserPlus, Users } from 'lucide-react';
import type { Project } from '@/lib/api';
import { manageProjectsPath } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import ProjectSwitcherTeamGroup, {
  type TeamGroup,
} from '@/components/layout/ProjectSwitcherTeamGroup';

// The projects grouped by the team that owns them, keeping the order of the list.
// `shortcut` is the project's place in the whole list, which is what ⌘1..9 switches
// by (useKeyboardShortcuts), so grouping does not renumber it.
function groupByTeam(projects: Project[]): TeamGroup[] {
  const groups: TeamGroup[] = [];
  projects.forEach((project, i) => {
    let group = groups.find((g) => g.teamId === project.teamId);
    if (!group) {
      group = { teamId: project.teamId, teamName: project.teamName, projects: [] };
      groups.push(group);
    }
    group.projects.push({ project, shortcut: i < 9 ? i + 1 : null });
  });
  return groups;
}

// Project picker in the sidebar header, modeled on the shadcn TeamSwitcher.
export default function ProjectSwitcher({
  projects,
  currentProjectKey,
  onSelectProject,
  onNewProject,
}: {
  projects: Project[];
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  onNewProject: () => void;
}) {
  const t = useTranslations('nav');
  const { isMobile } = useSidebar();
  const current = projects.find((b) => b.key === currentProjectKey);
  const groups = groupByTeam(projects);
  // Which teams the user folded away. Held here rather than in each group: the menu
  // unmounts its content when it closes, so the choice would not survive reopening.
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={projects.length === 0}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SquareKanban className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current?.name ?? t('noProjects')}</span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {current && (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded px-1 py-0 font-mono text-[10px] text-muted-foreground"
                    >
                      {current.key}
                    </Badge>
                  )}
                  <Users className="size-3 shrink-0" />
                  <span className="truncate">{current?.teamName ?? '—'}</span>
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-[300px] rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('projects')}
            </DropdownMenuLabel>
            {groups.map((group) => (
              <ProjectSwitcherTeamGroup
                key={group.teamId}
                group={group}
                open={!collapsed[group.teamId]}
                onOpenChange={(open) =>
                  setCollapsed((prev) => ({ ...prev, [group.teamId]: !open }))
                }
                onSelectProject={onSelectProject}
              />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewProject} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">{t('newProject')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href={manageProjectsPath()}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Settings2 className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">{t('manageProjects')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <UserPlus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">{t('newTeam')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Users className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">{t('manageTeams')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
