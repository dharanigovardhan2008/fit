import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

// "Are you sure?" dialog for permanent deletes.
export function ConfirmDelete({
  open, title, message, confirmLabel = "Delete", onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-5 text-text-secondary">{message}</p>
        <Button
          variant="danger"
          fullWidth
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
