import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { listMyGyms } from "../../lib/backend";
import { Plus } from "lucide-react";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import type { GymOption } from "../../types";

// Owner only: pick which of your gyms you are working in, or add a new one.
export function GymSwitcher() {
  const { session, switchGym, createGym } = useAuth();
  const { data: db } = useDb();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // Reload the list when the gym is renamed, so changes show up in the dropdown straight away.
  const activeName = db?.gyms.find((g) => g.gymId === session?.gymId)?.name;
  useEffect(() => {
    if (session?.role !== "owner") return;
    listMyGyms().then(setGyms).catch(() => undefined);
  }, [session?.role, session?.gymId, activeName]);

  if (session?.role !== "owner") return null;

  async function onChange(value: string) {
    if (!value || value === session?.gymId) return;
    try {
      await switchGym(value);
      await queryClient.invalidateQueries();
      navigate("/owner", { replace: true });
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not switch gyms.", "error");
    }
  }

  async function onCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createGym(name.trim(), address.trim());
      await queryClient.invalidateQueries();
      setShowAdd(false);
      setName("");
      setAddress("");
      notify("Gym added");
      navigate("/owner/settings", { replace: true });
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not add the gym.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dropdown
        variant="pill"
        align="right"
        ariaLabel="Switch gym"
        value={session.gymId}
        options={
          gyms.length === 0
            ? [{ value: session.gymId, label: activeName ?? "My gym" }]
            : gyms.map((g) => ({ value: g.gymId, label: g.gymId === session.gymId && activeName ? activeName : g.name }))
        }
        onChange={onChange}
        actions={[{ label: "Add gym", icon: <Plus size={14} aria-hidden="true" />, onClick: () => setShowAdd(true) }]}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add gym">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate();
          }}
        >
          <p className="text-[13px] text-text-secondary">
            The new gym uses your same sign-in. It gets its own members, trainers and plans.
          </p>
          <Input id="new-gym-name" label="Gym name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="new-gym-address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Button type="submit" fullWidth loading={saving} disabled={!name.trim()}>Create gym</Button>
        </form>
      </Modal>
    </>
  );
}
