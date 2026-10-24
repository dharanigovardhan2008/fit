import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { changePassword, deleteGym, removeEquipment, updateGymSettings, upsertEquipment, upsertPlan } from "../../lib/backend";
import { formatCurrency } from "../../lib/format";

export default function OwnerSettings() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const gym = db?.gyms.find((g) => g.gymId === session?.gymId);
  const { logout, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const plans = useMemo(() => (db?.plans ?? []).filter((p) => p.gymId === session?.gymId), [db, session]);
  const equipment = useMemo(() => (db?.equipment ?? []).filter((e) => e.gymId === session?.gymId), [db, session]);

  const [profile, setProfile] = useState({ name: "", address: "", radiusM: 100, closingTime: "22:00", latitude: "", longitude: "" });
  const [loadedGymId, setLoadedGymId] = useState<string | null>(null);
  if (gym && loadedGymId !== gym.gymId) {
    setProfile({
      name: gym.name, address: gym.address ?? "", radiusM: gym.radiusM, closingTime: gym.closingTime,
      latitude: gym.latitude?.toString() ?? "", longitude: gym.longitude?.toString() ?? "",
    });
    setLoadedGymId(gym.gymId);
  }

  const [rewards, setRewards] = useState({ pointsPerVisit: "10", streakBonus: "50", pointValue: "0.5", maxDiscountPct: "30" });
  const [rewardsGymId, setRewardsGymId] = useState<string | null>(null);
  if (gym && rewardsGymId !== gym.gymId) {
    setRewards({
      pointsPerVisit: String(gym.pointsPerVisit), streakBonus: String(gym.streakBonus),
      pointValue: String(gym.pointValue), maxDiscountPct: String(gym.maxDiscountPct),
    });
    setRewardsGymId(gym.gymId);
  }

  const [newPlan, setNewPlan] = useState({ name: "", durationDays: "", price: "" });
  const [newEquipment, setNewEquipment] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "" });

  async function saveProfile() {
    if (!gym) return;
    await updateGymSettings(gym.gymId, {
      name: profile.name, address: profile.address, radiusM: Number(profile.radiusM), closingTime: profile.closingTime,
      latitude: profile.latitude ? Number(profile.latitude) : null, longitude: profile.longitude ? Number(profile.longitude) : null,
    });
    invalidate();
    notify("Gym settings saved");
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      notify("Location is not available on this device.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfile((p) => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        notify("Location detected");
      },
      () => notify("We could not detect your location. Enter it manually.", "error"),
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Settings" description="Gym profile, location, plans and equipment." />

      <Card className="flex flex-col gap-4">
        <CardTitle>Gym profile</CardTitle>
        <div className="rounded-2xl bg-ink p-4 text-on-ink">
          <p className="text-[11px] text-white/60">Gym code (share with your team to log in)</p>
          <p className="text-[22px] font-semibold tracking-widest">{gym?.code}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="g-name" label="Gym name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input id="g-address" label="Address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <Input id="g-radius" label="Check-in radius (metres)" type="number" value={profile.radiusM} onChange={(e) => setProfile({ ...profile, radiusM: Number(e.target.value) })} />
          <Input id="g-closing" label="Closing time" type="time" value={profile.closingTime} onChange={(e) => setProfile({ ...profile, closingTime: e.target.value })} />
          <Input id="g-lat" label="Latitude" value={profile.latitude} onChange={(e) => setProfile({ ...profile, latitude: e.target.value })} />
          <Input id="g-lng" label="Longitude" value={profile.longitude} onChange={(e) => setProfile({ ...profile, longitude: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={detectLocation}><LocateFixed size={16} /> Detect my location</Button>
          <Button onClick={saveProfile}>Save changes</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Plans and prices</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.planId} className="rounded-xl bg-thumb p-3">
              <p className="text-[13px] font-semibold">{p.name}</p>
              <p className="text-[11px] text-text-secondary">{p.durationDays} days - {formatCurrency(p.price)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input id="p-name" label="Plan name" value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
          <Input id="p-duration" label="Duration (days)" type="number" value={newPlan.durationDays} onChange={(e) => setNewPlan({ ...newPlan, durationDays: e.target.value })} />
          <Input id="p-price" label="Price" type="number" value={newPlan.price} onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })} />
          <div className="flex items-end">
            <Button
              fullWidth
              onClick={async () => {
                if (!gym || !newPlan.name || !newPlan.durationDays || !newPlan.price) return;
                await upsertPlan(gym.gymId, { name: newPlan.name, durationDays: Number(newPlan.durationDays), price: Number(newPlan.price) });
                invalidate();
                setNewPlan({ name: "", durationDays: "", price: "" });
                notify("Plan added");
              }}
            >
              <Plus size={16} /> Add plan
            </Button>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Equipment</CardTitle>
        <ul className="divide-y divide-track">
          {equipment.map((e) => (
            <li key={e.equipmentId} className="flex items-center justify-between py-2.5 text-[13px]">
              <span>{e.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-text-secondary">Condition {e.conditionScore.toFixed(1)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${e.name}`}
                  className="rounded-full p-1.5 text-text-secondary hover:bg-danger/10 hover:text-danger"
                  onClick={async () => {
                    if (!gym) return;
                    await removeEquipment(gym.gymId, e.equipmentId);
                    invalidate();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input id="new-equipment" label="" placeholder="New equipment name" value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)} className="flex-1" />
          <Button
            onClick={async () => {
              if (!gym || !newEquipment.trim()) return;
              await upsertEquipment(gym.gymId, { name: newEquipment.trim() });
              invalidate();
              setNewEquipment("");
              notify("Equipment added");
            }}
          >
            <Plus size={16} /> Add
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Change password</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="cp-current" label="Current password" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
          <Input id="cp-next" label="New password" type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
        </div>
        <Button
          className="self-start"
          onClick={async () => {
            if (!session) return;
            if (passwords.next.length < 8) {
              notify("Use at least 8 characters for your new password.", "error");
              return;
            }
            await changePassword(session.userId, passwords.next);
            setPasswords({ current: "", next: "" });
            notify("Password updated");
          }}
        >
          Update password
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Reward points</CardTitle>
        <p className="text-[13px] leading-5 text-text-secondary">
          Members earn points for every day they check in and can spend them to reduce the price of a renewal.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="rw-visit" label="Points per visit" type="number" min={0} value={rewards.pointsPerVisit}
            onChange={(e) => setRewards({ ...rewards, pointsPerVisit: e.target.value })} />
          <Input id="rw-bonus" label="Bonus for 7 days in a row" type="number" min={0} value={rewards.streakBonus}
            onChange={(e) => setRewards({ ...rewards, streakBonus: e.target.value })} />
          <Input id="rw-value" label="Rupees per point" type="number" min={0} step="0.1" value={rewards.pointValue}
            onChange={(e) => setRewards({ ...rewards, pointValue: e.target.value })} />
          <Input id="rw-max" label="Most of a plan points can pay (%)" type="number" min={0} max={100} value={rewards.maxDiscountPct}
            onChange={(e) => setRewards({ ...rewards, maxDiscountPct: e.target.value })} />
        </div>
        <Button
          onClick={async () => {
            if (!gym) return;
            try {
              await updateGymSettings(gym.gymId, {
                pointsPerVisit: Math.max(0, Math.round(Number(rewards.pointsPerVisit))),
                streakBonus: Math.max(0, Math.round(Number(rewards.streakBonus))),
                pointValue: Math.max(0, Number(rewards.pointValue)),
                maxDiscountPct: Math.min(100, Math.max(0, Math.round(Number(rewards.maxDiscountPct)))),
              });
              invalidate();
              notify("Reward settings saved");
            } catch (err) {
              notify(err instanceof Error ? err.message : "Could not save.", "error");
            }
          }}
        >
          Save rewards
        </Button>
      </Card>

      <Card className="flex flex-col gap-4 border border-danger/30">
        <CardTitle>Delete gym</CardTitle>
        <p className="text-[13px] leading-5 text-text-secondary">
          This permanently deletes this gym and everything in it: all its members, trainers, attendance
          and payments. Your other gyms are not touched. This cannot be undone.
        </p>
        <Input id="delete-gym" label='Type DELETE to confirm' value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
        <Button
          variant="danger"
          loading={deleting}
          disabled={deleteText !== "DELETE"}
          onClick={async () => {
            setDeleting(true);
            try {
              const next = await deleteGym();
              if (next) {
                refreshSession();
                await queryClient.invalidateQueries();
                navigate("/owner", { replace: true });
              } else {
                logout();
                navigate("/register", { replace: true });
              }
            } catch (err) {
              notify(err instanceof Error ? err.message : "We could not delete the gym.", "error");
            } finally {
              setDeleting(false);
            }
          }}
        >
          Delete gym and all data
        </Button>
      </Card>
    </div>
  );
}
