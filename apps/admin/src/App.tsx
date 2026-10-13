import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider, useAuth } from "./lib/auth";
import { AwayGamesPage } from "./pages/AwayGamesPage";
import { BehaviorPage } from "./pages/BehaviorPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { ComparisonsPage } from "./pages/ComparisonsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FanEditPage } from "./pages/FanEditPage";
import { FanProfilePage } from "./pages/FanProfilePage";
import { FansPage } from "./pages/FansPage";
import { HomeGamesPage } from "./pages/HomeGamesPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StorePage } from "./pages/StorePage";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";

function RequireAuth({
  children,
  allowOnboarding = false,
}: {
  children: ReactNode;
  allowOnboarding?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="size-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // A new manager must set up the club before seeing the dashboard
  if (!user.onboarded && !allowOnboarding) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          path="onboarding"
          element={
            <RequireAuth allowOnboarding>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="fans" element={<FansPage />} />
          <Route path="fans/:id" element={<FanProfilePage />} />
          <Route path="fans/:id/edit" element={<FanEditPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="home-games" element={<HomeGamesPage />} />
          <Route path="away-games" element={<AwayGamesPage />} />
          <Route path="behavior" element={<BehaviorPage />} />
          <Route path="comparisons" element={<ComparisonsPage />} />
          <Route path="store" element={<StorePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
