import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { ownerNav } from "../../lib/navigation";

const extraLinks = ownerNav.filter((item) => !item.tab);

export default function OwnerMore() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in lg:hidden">
      <PageHeader title="More" description="Everything else you can manage for your gym." />
      <Card className="divide-y divide-track p-0">
        {extraLinks.map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-3 text-[14px] font-medium text-text-primary">
              <item.icon size={18} className="text-text-secondary" />
              {item.label}
            </span>
            <ChevronRight size={16} className="text-text-secondary" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
