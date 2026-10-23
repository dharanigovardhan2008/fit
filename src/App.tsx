import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ToastProvider } from "./components/ui/Toast";
import { AppShell } from "./components/layout/AppShell";
import { ownerNav, trainerNav, memberNav } from "./lib/navigation";

import LoginPage from "./pages/auth/LoginPage";
import RegisterGymPage from "./pages/auth/RegisterGymPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";

import OwnerDashboard from "./pages/owner/OwnerDashboard";
import OwnerTrainers from "./pages/owner/OwnerTrainers";
import OwnerMembers from "./pages/owner/OwnerMembers";
import OwnerAttendance from "./pages/owner/OwnerAttendance";
import OwnerSubscriptions from "./pages/owner/OwnerSubscriptions";
import OwnerRatings from "./pages/owner/OwnerRatings";
import OwnerRequests from "./pages/owner/OwnerRequests";
import OwnerAnalytics from "./pages/owner/OwnerAnalytics";
import OwnerAlerts from "./pages/owner/OwnerAlerts";
import OwnerSettings from "./pages/owner/OwnerSettings";
import OwnerMore from "./pages/owner/OwnerMore";
import OwnerPendingRequests from "./pages/owner/OwnerPendingRequests";

import TrainerHome from "./pages/trainer/TrainerHome";
import TrainerMembers from "./pages/trainer/TrainerMembers";
import TrainerAttendance from "./pages/trainer/TrainerAttendance";
import TrainerProfile from "./pages/trainer/TrainerProfile";
import TrainerSalary from "./pages/trainer/TrainerSalary";
import TrainerRating from "./pages/trainer/TrainerRating";
import TrainerAlerts from "./pages/trainer/TrainerAlerts";
import TrainerRequests from "./pages/trainer/TrainerRequests";
import TrainerPendingRequests from "./pages/trainer/TrainerPendingRequests";

import MemberHome from "./pages/member/MemberHome";
import MemberCheckIn from "./pages/member/MemberCheckIn";
import MemberTrainer from "./pages/member/MemberTrainer";
import MemberProgress from "./pages/member/MemberProgress";
import MemberSubscription from "./pages/member/MemberSubscription";
import MemberRate from "./pages/member/MemberRate";
import MemberRequests from "./pages/member/MemberRequests";
import MemberProfile from "./pages/member/MemberProfile";

import DevTestPage from "./pages/dev/DevTestPage";
import ManualAttendance from "./pages/shared/ManualAttendance";
import TrainerMyAttendance from "./pages/trainer/TrainerMyAttendance";
import OwnerTrainerAttendance from "./pages/owner/OwnerTrainerAttendance";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/register" element={<RegisterGymPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />

              <Route element={<ProtectedRoute role="owner" />}>
                <Route element={<AppShell items={ownerNav} greeting="Good to see you" />}>
                  <Route path="/owner" element={<OwnerDashboard />} />
                  <Route path="/owner/trainers" element={<OwnerTrainers />} />
                  <Route path="/owner/members" element={<OwnerMembers />} />
                  <Route path="/owner/attendance" element={<OwnerAttendance />} />
                  <Route path="/owner/subscriptions" element={<OwnerSubscriptions />} />
                  <Route path="/owner/ratings" element={<OwnerRatings />} />
                  <Route path="/owner/requests" element={<OwnerRequests />} />
                  <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                  <Route path="/owner/alerts" element={<OwnerAlerts />} />
                  <Route path="/owner/settings" element={<OwnerSettings />} />
                  <Route path="/owner/more" element={<OwnerMore />} />
                  <Route path="/owner/manual-attendance" element={<ManualAttendance />} />
                  <Route path="/owner/trainer-attendance" element={<OwnerTrainerAttendance />} />
                  <Route path="/owner/pending-attendance" element={<OwnerPendingRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="trainer" />}>
                <Route element={<AppShell items={trainerNav} greeting="Welcome back" />}>
                  <Route path="/trainer" element={<TrainerHome />} />
                  <Route path="/trainer/members" element={<TrainerMembers />} />
                  <Route path="/trainer/attendance" element={<TrainerAttendance />} />
                  <Route path="/trainer/profile" element={<TrainerProfile />} />
                  <Route path="/trainer/salary" element={<TrainerSalary />} />
                  <Route path="/trainer/rating" element={<TrainerRating />} />
                  <Route path="/trainer/alerts" element={<TrainerAlerts />} />
                  <Route path="/trainer/requests" element={<TrainerRequests />} />
                  <Route path="/trainer/manual-attendance" element={<ManualAttendance />} />
                  <Route path="/trainer/my-attendance" element={<TrainerMyAttendance />} />
                  <Route path="/trainer/pending-attendance" element={<TrainerPendingRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="member" />}>
                <Route element={<AppShell items={memberNav} raisedTo="/member/checkin" greeting="Good to see you" />}>
                  <Route path="/member" element={<MemberHome />} />
                  <Route path="/member/checkin" element={<MemberCheckIn />} />
                  <Route path="/member/trainer" element={<MemberTrainer />} />
                  <Route path="/member/progress" element={<MemberProgress />} />
                  <Route path="/member/subscription" element={<MemberSubscription />} />
                  <Route path="/member/rate" element={<MemberRate />} />
                  <Route path="/member/requests" element={<MemberRequests />} />
                  <Route path="/member/profile" element={<MemberProfile />} />
                </Route>
              </Route>

              {import.meta.env.DEV && <Route path="/dev/test" element={<DevTestPage />} />}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
