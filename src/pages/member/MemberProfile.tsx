import { useState } from "react";
import { Download, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { changePassword, exportMemberData, requestAccountDeletion } from "../../lib/backend";
import { initials } from "../../lib/format";

export default function MemberProfile() {
  const { session, logout } = useAuth();
  const { data: db } = useDb();
  const { notify } = useToast();
  const user = db?.users.find((u) => u.userId === session?.userId);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function exportData() {
    if (!session) return;
    const data = exportMemberData(session.gymId, session.userId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.publicId}-gymsphere-data.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Profile" />

      <Card className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-on-ink">
          {initials(session?.name ?? "")}
        </div>
        <div>
          <p className="text-[16px] font-semibold">{session?.name}</p>
          <p className="text-[12px] text-text-secondary">{session?.publicId}</p>
          <p className="text-[12px] text-text-secondary">{user?.email}</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Change password</CardTitle>
        <Input id="mp-password" label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <Button
          className="self-start"
          onClick={async () => {
            if (!session) return;
            if (newPassword.length < 8) {
              notify("Use at least 8 characters.", "error");
              return;
            }
            await changePassword(session.userId, newPassword);
            setNewPassword("");
            notify("Password updated");
          }}
        >
          Update password
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Your data</CardTitle>
        <Button variant="secondary" className="self-start" onClick={exportData}>
          <Download size={16} /> Export my data
        </Button>
        <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} /> Request account deletion
        </Button>
      </Card>

      <button
        type="button"
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-white py-3 text-[13px] font-medium text-danger"
      >
        <LogOut size={16} /> Log out
      </button>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Request account deletion">
        <p className="text-[13px] leading-5 text-text-secondary">
          This sends a deletion request to your gym owner. Your account stays active until they confirm.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              if (!session) return;
              await requestAccountDeletion(session.gymId, session.userId);
              setConfirmDelete(false);
              notify("Deletion request sent to the owner");
            }}
          >
            Send request
          </Button>
        </div>
      </Modal>
    </div>
  );
}
