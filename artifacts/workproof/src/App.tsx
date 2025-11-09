import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import EmployeesPage from "@/pages/EmployeesPage";
import EmployeeDetailPage from "@/pages/EmployeeDetailPage";
import DepartmentsPage from "@/pages/DepartmentsPage";
import TeamsPage from "@/pages/TeamsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import TasksPage from "@/pages/TasksPage";
import AttendancePage from "@/pages/AttendancePage";
import TrainingsPage from "@/pages/TrainingsPage";
import RecognitionsPage from "@/pages/RecognitionsPage";
import MeetingsPage from "@/pages/MeetingsPage";
import AuditLogPage from "@/pages/AuditLogPage";
import ChatPage from "@/pages/ChatPage";
import MLApiPage from "@/pages/MLApiPage";
import VerificationsPage from "@/pages/VerificationsPage";
import LeavesPage from "@/pages/LeavesPage";
import MeetingRoomPage from "@/pages/MeetingRoomPage";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,8%)] flex items-center justify-center">
        <div className="text-[hsl(215,20%,55%)] text-sm">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return <Redirect to="/login" />;
  }

  // Force password change if required
  if ((user as any)?.mustChangePassword) {
    return <Redirect to="/change-password" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { token, user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/change-password">
        {!isLoading && !token ? <Redirect to="/login" /> : <ChangePasswordPage />}
      </Route>
      <Route path="/">
        {!isLoading && !token ? <Redirect to="/login" /> : <Redirect to="/dashboard" />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/employees/:id">
        <ProtectedRoute component={EmployeeDetailPage} />
      </Route>
      <Route path="/employees">
        <ProtectedRoute component={EmployeesPage} />
      </Route>
      <Route path="/departments">
        <ProtectedRoute component={DepartmentsPage} />
      </Route>
      <Route path="/teams">
        <ProtectedRoute component={TeamsPage} />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={DocumentsPage} />
      </Route>
      <Route path="/projects">
        <ProtectedRoute component={ProjectsPage} />
      </Route>
      <Route path="/tasks">
        <ProtectedRoute component={TasksPage} />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={AttendancePage} />
      </Route>
      <Route path="/trainings">
        <ProtectedRoute component={TrainingsPage} />
      </Route>
      <Route path="/recognitions">
        <ProtectedRoute component={RecognitionsPage} />
      </Route>
      <Route path="/meetings">
        <ProtectedRoute component={MeetingsPage} />
      </Route>
      <Route path="/meetings/:id/room">
        <ProtectedRoute component={MeetingRoomPage} />
      </Route>
      <Route path="/audit-log">
        <ProtectedRoute component={AuditLogPage} />
      </Route>
      <Route path="/chat">
        <ProtectedRoute component={ChatPage} />
      </Route>
      <Route path="/verifications">
        <ProtectedRoute component={VerificationsPage} />
      </Route>
      <Route path="/leaves">
        <ProtectedRoute component={LeavesPage} />
      </Route>
      <Route path="/ml-api">
        <ProtectedRoute component={MLApiPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
