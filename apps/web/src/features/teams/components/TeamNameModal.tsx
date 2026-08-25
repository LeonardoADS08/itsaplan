'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';

// The name form both team dialogs use: create and rename differ only in their
// labels and what they do with the name.
export default function TeamNameModal({
  title,
  placeholder,
  submitLabel,
  hint,
  initialName = '',
  busy,
  onSubmit,
  onClose,
}: {
  title: string;
  placeholder: string;
  submitLabel: string;
  hint?: string;
  initialName?: string;
  busy: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const canSubmit = !busy && name.trim() !== '';

  function submit() {
    if (!canSubmit) return;
    onSubmit(name.trim());
  }

  return (
    <Modal title={title} onClose={onClose} className="pb-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Users className="size-5" />
          </div>
          <input
            dir={name ? 'auto' : undefined}
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
            autoFocus
          />
        </div>

        {hint && <p className="mt-3 text-sm text-muted-foreground">{hint}</p>}

        <div className="mt-4 flex items-center border-t pt-3">
          <Button className="ms-auto" disabled={!canSubmit} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
