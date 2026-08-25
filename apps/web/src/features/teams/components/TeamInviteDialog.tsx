'use client';

import { useState, type FormEvent } from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteTeamRole, TeamRole } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTeamInvite } from '@/services/teams.service';

// Invites someone to the team itself: they join its member list and reach its
// projects through a membership added afterwards. Only an owner can invite a
// manager, so a manager is offered the member rank alone.
export default function TeamInviteDialog({
  teamId,
  teamName,
  teamRole,
  onClose,
}: {
  teamId: number;
  teamName: string;
  teamRole: TeamRole;
  onClose: () => void;
}) {
  const t = useTranslations('teams.invite');
  const tManage = useTranslations('teams.manage');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteTeamRole>('member');
  const createInvite = useCreateTeamInvite(teamId);

  const ranks: InviteTeamRole[] = teamRole === 'owner' ? ['member', 'manager'] : ['member'];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    try {
      await createInvite.mutateAsync({ email: address, role });
      onClose();
    } catch {
      // The global handler toasts the reason; keep the dialog open for a retry.
    }
  }

  return (
    <Modal
      title={t('title')}
      scope={
        <>
          <Users className="size-3.5" />
          {teamName}
        </>
      }
      description={t('description')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('emailLabel')}</p>
          <Input
            type="email"
            placeholder={t('emailPlaceholder')}
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={createInvite.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('roleLabel')}</p>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as InviteTeamRole)}
            disabled={createInvite.isPending || ranks.length === 1}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ranks.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {tManage(`roles.${rank}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t(`roleHint.${role}`)}</p>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={createInvite.isPending || !email.trim()}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
