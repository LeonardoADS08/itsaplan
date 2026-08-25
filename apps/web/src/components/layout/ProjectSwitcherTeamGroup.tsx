import { ChevronRight, SquareKanban, Users } from 'lucide-react';
import type { Project } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenuItem, DropdownMenuShortcut } from '@/components/ui/dropdown-menu';

export interface TeamGroup {
  teamId: number;
  teamName: string;
  projects: { project: Project; shortcut: number | null }[];
}

// One team's projects in the project switcher, foldable by its header. The open
// state is owned by the switcher, which outlives the menu's content.
export default function ProjectSwitcherTeamGroup({
  group,
  open,
  onOpenChange,
  onSelectProject,
}: {
  group: TeamGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (key: string) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      {/* A menu item rather than a plain button: only items take part in the
          dropdown's keyboard navigation. Selecting one closes the menu, which
          folding a team must not do. */}
      <CollapsibleTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="gap-1.5 px-2 py-1.5 text-xs text-muted-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
          <Users className="size-3.5 shrink-0" />
          <span className="truncate font-medium">{group.teamName}</span>
          <span className="ms-auto flex shrink-0 items-center gap-1">
            <SquareKanban className="size-3.5" />
            <span className="tabular-nums">{group.projects.length}</span>
          </span>
        </DropdownMenuItem>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.projects.map(({ project, shortcut }) => (
          <DropdownMenuItem
            key={project.key}
            onClick={() => onSelectProject(project.key)}
            className="gap-2 p-2"
          >
            <Badge
              variant="outline"
              className="w-12 shrink-0 rounded px-1 py-0 font-mono text-[10px] text-muted-foreground"
            >
              {project.key}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {shortcut && <DropdownMenuShortcut>⌘{shortcut}</DropdownMenuShortcut>}
          </DropdownMenuItem>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
