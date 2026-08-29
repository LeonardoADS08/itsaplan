import { Ban } from 'lucide-react';
import type { AgentTool } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

// One action in the Actions checklist. A read-only action is shown checked and
// disabled, with a tooltip saying why it cannot be turned off. An action the agent's
// role refuses stays togglable — the role is what has to change — and is marked so
// the 403 is seen here rather than at run time.
export function AgentActionRow({
  tool,
  checked,
  refused,
  onToggle,
}: {
  tool: AgentTool;
  checked: boolean;
  refused: boolean;
  onToggle: (on: boolean) => void;
}) {
  const t = useTranslations('teams.agents');

  const body = (
    <span>
      <span className="text-sm">
        {tool.label}
        {/* A native title, not a Tooltip: an always-on row is already wrapped in one,
            and a trigger inside a trigger swallows the outer tooltip. */}
        {refused && (
          <span title={t('roleRefusesAction')} aria-label={t('roleRefusesAction')}>
            <Ban className="ms-1 inline size-3.5 align-text-bottom text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="block text-xs text-muted-foreground">{tool.description}</span>
    </span>
  );

  if (tool.always) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-start gap-2 opacity-70">
            <Checkbox className="mt-0.5" checked disabled />
            {body}
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('readOnlyAlwaysOn')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onToggle(v === true)}
      />
      {body}
    </label>
  );
}
