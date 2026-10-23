import {
  LayoutGrid, Users, QrCode, BarChart3, MoreHorizontal, Wallet, Star, GitPullRequestArrow,
  Bell, Settings, UserCircle, Dumbbell, LineChart, ScanLine, ClipboardList, ClipboardCheck, UserCheck,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tab?: boolean;
  /** If true, a pending-count badge is shown on this nav item */
  badge?: "attendance_requests";
}

export const ownerNav: NavItem[] = [
  { to: "/owner", label: "Home", icon: LayoutGrid, tab: true },
  { to: "/owner/members", label: "Members", icon: Users, tab: true },
  { to: "/owner/attendance", label: "Attendance", icon: QrCode, tab: true },
  { to: "/owner/analytics", label: "Analytics", icon: BarChart3, tab: true },
  { to: "/owner/more", label: "More", icon: MoreHorizontal, tab: true },
  { to: "/owner/manual-attendance", label: "Manual Attendance", icon: UserCheck },
  { to: "/owner/trainer-attendance", label: "Trainer Attendance", icon: ClipboardCheck },
  { to: "/owner/trainers", label: "Trainers", icon: Dumbbell },
  { to: "/owner/subscriptions", label: "Subscriptions", icon: Wallet },
  { to: "/owner/ratings", label: "Ratings", icon: Star },
  { to: "/owner/requests", label: "Requests", icon: GitPullRequestArrow },
  { to: "/owner/pending-attendance", label: "Pending Attendance", icon: ClipboardCheck, badge: "attendance_requests" },
  { to: "/owner/alerts", label: "Alerts", icon: Bell },
  { to: "/owner/settings", label: "Settings", icon: Settings },
];

export const trainerNav: NavItem[] = [
  { to: "/trainer", label: "Home", icon: LayoutGrid, tab: true },
  { to: "/trainer/members", label: "Members", icon: Users, tab: true },
  { to: "/trainer/attendance", label: "Attendance", icon: QrCode, tab: true },
  { to: "/trainer/pending-attendance", label: "Pending", icon: ClipboardCheck, tab: true, badge: "attendance_requests" },
  { to: "/trainer/my-attendance", label: "My Attendance", icon: ClipboardCheck },
  { to: "/trainer/manual-attendance", label: "Mark Members", icon: UserCheck },
  { to: "/trainer/salary", label: "Salary", icon: Wallet },
  { to: "/trainer/rating", label: "My Rating", icon: Star },
  { to: "/trainer/alerts", label: "Alerts", icon: Bell },
  { to: "/trainer/requests", label: "Requests", icon: GitPullRequestArrow },
  { to: "/trainer/profile", label: "Profile", icon: UserCircle },
];

export const memberNav: NavItem[] = [
  { to: "/member", label: "Home", icon: LayoutGrid, tab: true },
  { to: "/member/subscription", label: "Plan", icon: ClipboardList, tab: true },
  { to: "/member/checkin", label: "Check-in", icon: ScanLine, tab: true },
  { to: "/member/profile", label: "Profile", icon: UserCircle, tab: true },
  { to: "/member/trainer", label: "My Trainer", icon: Dumbbell },
  { to: "/member/progress", label: "Progress", icon: LineChart },
  { to: "/member/rate", label: "Rate", icon: Star },
  { to: "/member/requests", label: "Requests", icon: GitPullRequestArrow },
];
