import { Bot, MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { useShell } from '@/context/shellContext';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// The agents working in this project, read-only. An agent belongs to the team, so it
// is created, configured and attached to a project from the team section; a project
// member sees here which agents write in their project and can start a chat with one.
export default function ProjectAiAgents() {
  const t = useTranslations('settings.agents');
  const tTeam = useTranslations('teams.agents');
  const tChat = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const { onChatWithAgent } = useShell();
  const query = useProjectAgents();
  const agents = query.data ?? [];

  if (query.isPending) return <ListSkeleton rows={3} rowClassName="h-12" />;
  if (agents.length === 0) return <EmptyState title={t('empty')} description={t('emptyHint')} />;

  return (
    <Table className="min-w-[640px] table-fixed">
      <colgroup>
        <col className="w-[45%]" />
        <col className="w-[15%]" />
        <col className="w-[22%]" />
        <col className="w-[18%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">
            {tTeam('agent')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {tTeam('kind')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {tTeam('runner')}
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            {tCommon('actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent) => (
          <TableRow key={agent.id} className="group/item">
            <TableCell className="px-3 py-4 align-top whitespace-normal">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="truncate text-sm font-medium">{agent.name}</span>
                  <span className="truncate text-xs text-muted-foreground">@{agent.username}</span>
                </div>
              </div>
            </TableCell>
            <TableCell className="px-3 py-4 align-top">
              <Badge variant={agent.kind === 'internal' ? 'secondary' : 'outline'}>
                {tTeam(`kindLabel.${agent.kind}`)}
              </Badge>
            </TableCell>
            <TableCell className="px-3 py-4 align-top">
              {agent.kind === 'external' ? (
                <AgentRunnerStatus agent={agent} />
              ) : (
                <span className="text-xs text-muted-foreground">{tTeam('kindHint.internal')}</span>
              )}
            </TableCell>
            <TableCell className="px-3 py-3 align-top">
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" onClick={() => onChatWithAgent(agent.id)}>
                  <MessageSquarePlus className="size-4" />
                  {tChat('newChat')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
