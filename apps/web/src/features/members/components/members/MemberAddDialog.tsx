'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAddMember,
  useCreateInvite,
  useInvitesQuery,
  useMemberCandidatesQuery,
} from '@/services/members.service';
import { useProjectRolesQuery } from '@/services/roles.service';
import { usePermissions } from '@/hooks/usePermissions';
import MemberPicker, { type MemberOption } from './MemberPicker';

// Owner is not a custom role, so it sits outside the roles list under this value.
const OWNER_VALUE = 'owner';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adds someone to the project. A member of the team joins straight away; anyone else
// is invited by email and joins the team along with the project. Both carry the same
// role, so the dialog asks for who first and for the role second.
export default function MemberAddDialog({
  projectKey,
  projectName,
  teamName,
  canAdd,
  canInvite,
  onClose,
}: {
  projectKey: string;
  projectName: string;
  teamName: string;
  canAdd: boolean;
  canInvite: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('members.add');
  const tCommon = useTranslations('common');
  const { can, isAdmin } = usePermissions();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<MemberOption | null>(null);
  const [roleValue, setRoleValue] = useState('');
  const candidatesQuery = useMemberCandidatesQuery(projectKey, canAdd);
  const rolesQuery = useProjectRolesQuery(projectKey);
  const addMember = useAddMember(projectKey);
  const createInvite = useCreateInvite(projectKey);
  // The pending invites only mark an address as already invited, and reading them is
  // a permission of its own: whoever may invite without it goes without the marker.
  const canReadInvites = can('members_invite', 'read') || isAdmin;
  const invitesQuery = useInvitesQuery(projectKey, canInvite && canReadInvites);

  const candidates = candidatesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  // Default to the team's default role until another option is picked. Empty until
  // the roles load, so a submit before that cannot fall back to Owner.
  const defaultRoleId = roles.find((r) => r.isDefault)?.id ?? roles[0]?.id;
  const role = roleValue || (defaultRoleId != null ? String(defaultRoleId) : '');

  const typed = query.trim().toLowerCase();
  // An address nobody in the team carries is offered as an invite — unless the
  // project already invited it, which cannot be done a second time.
  const pendingEmails = (invitesQuery.data ?? [])
    .filter((one) => one.status === 'pending')
    .map((one) => one.email.toLowerCase());
  const typedIsNew =
    canInvite &&
    EMAIL_PATTERN.test(typed) &&
    !candidates.some((c) => c.email.toLowerCase() === typed);
  const invite = typedIsNew ? { email: typed, pending: pendingEmails.includes(typed) } : null;
  const busy = addMember.isPending || createInvite.isPending;

  async function submit() {
    if (!target || !role) return;
    const input =
      role === OWNER_VALUE
        ? { role: 'owner' as const }
        : { role: 'member' as const, roleId: Number(role) };
    try {
      if (target.kind === 'member') {
        await addMember.mutateAsync({ userId: target.candidate.userId, ...input });
      } else {
        await createInvite.mutateAsync({ email: target.email, ...input });
      }
      onClose();
    } catch {
      // The global handler toasts the reason; keep the dialog open for a retry.
    }
  }

  return (
    <Modal
      title={t('title')}
      crumb={projectName}
      scope={
        <>
          <Users className="size-3.5" />
          {teamName}
        </>
      }
      description={t('description')}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('personLabel')}</p>
          <MemberPicker
            candidates={candidates}
            value={target}
            onChange={setTarget}
            query={query}
            onQueryChange={setQuery}
            invite={invite}
            canAdd={canAdd}
            canInvite={canInvite}
            disabled={busy}
          />
          {target?.kind === 'invite' && (
            <p className="text-xs text-muted-foreground">{t('willJoinTeam', { teamName })}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('roleLabel')}</p>
          <Select value={role} onValueChange={setRoleValue} disabled={busy}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('rolePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
              <SelectItem value={OWNER_VALUE}>{tCommon('owner')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button disabled={!target || !role || busy} onClick={submit}>
            {target?.kind === 'invite' ? t('sendInvite') : t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
