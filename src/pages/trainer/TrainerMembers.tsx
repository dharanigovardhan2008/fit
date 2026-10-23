import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchField } from "../../components/ui/SearchField";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";
import { formatDate, initials } from "../../lib/format";
import { todayStr } from "../../lib/backend";

export default function TrainerMembers() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const [search, setSearch] = useState("");

  const members = useMemo(() => {
    if (!db || !session) return [];
    const today = todayStr();
    return db.members
      .filter((m) => m.assignedTrainerId === session.userId)
      .map((m) => {
        const user = db.users.find((u) => u.userId === m.userId)!;
        const sub = db.subscriptions.filter((s) => s.memberId === m.userId).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        return { member: m, user, sub, isActive: !!sub && sub.status === "active" && sub.endDate >= today };
      })
      .filter((row) => row.user.name.toLowerCase().includes(search.toLowerCase()));
  }, [db, session, search]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="My Members" description="Everyone currently assigned to you." />
      <SearchField placeholder="Search your members" value={search} onChange={(e) => setSearch(e.target.value)} />

      {members.length === 0 ? (
        <EmptyState title="No members assigned yet" description="New members matching your shift and specialty will be assigned to you automatically." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map(({ member, user, sub, isActive }) => (
            <Card key={member.userId} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-thumb text-[13px] font-semibold">
                {initials(user.name)}
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold">{user.name}</p>
                <p className="text-[11px] text-text-secondary">{member.goal || "No goal noted"}</p>
                <p className="text-[11px] text-text-secondary">Plan ends {sub ? formatDate(sub.endDate) : "-"}</p>
              </div>
              <Badge tone={isActive ? "success" : "danger"}>{isActive ? "Active" : "Expired"}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
