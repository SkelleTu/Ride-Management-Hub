import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "@/pages/not-found";

import RoleSelection from "@/pages/index";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";

import PassengerHome from "@/pages/passenger/index";
import PassengerRide from "@/pages/passenger/ride";
import PassengerHistory from "@/pages/passenger/history";

import DriverHome from "@/pages/driver/index";
import DriverOffer from "@/pages/driver/offer";
import DriverRide from "@/pages/driver/ride";
import DriverProfile from "@/pages/driver/profile";
import DriverHistory from "@/pages/driver/history";

import AdminHome from "@/pages/admin/index";
import AdminDrivers from "@/pages/admin/drivers";
import AdminDriverDetail from "@/pages/admin/driver-detail";
import AdminPassengers from "@/pages/admin/passengers";
import AdminRides from "@/pages/admin/rides";
import AdminUsers from "@/pages/admin/users";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={RoleSelection} />
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />

      <Route path="/passenger">
        <ProtectedRoute allowedRoles={["passenger", "admin"]}>
          <AppLayout>
            <PassengerHome />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/passenger/history">
        <ProtectedRoute allowedRoles={["passenger", "admin"]}>
          <AppLayout>
            <PassengerHistory />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/passenger/ride/:id">
        {(params) => (
          <ProtectedRoute allowedRoles={["passenger", "admin"]}>
            <AppLayout>
              <PassengerRide params={params} />
            </AppLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver", "admin"]}>
          <AppLayout>
            <DriverHome />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/profile">
        <ProtectedRoute allowedRoles={["driver", "admin"]}>
          <AppLayout>
            <DriverProfile />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/history">
        <ProtectedRoute allowedRoles={["driver", "admin"]}>
          <AppLayout>
            <DriverHistory />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/offer/:rideId">
        {(params) => (
          <ProtectedRoute allowedRoles={["driver", "admin"]}>
            <AppLayout>
              <DriverOffer params={params} />
            </AppLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/driver/ride/:id">
        {(params) => (
          <ProtectedRoute allowedRoles={["driver", "admin"]}>
            <AppLayout>
              <DriverRide params={params} />
            </AppLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminHome />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminDrivers />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers/:id">
        {(params) => (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout>
              <AdminDriverDetail params={params} />
            </AppLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/passengers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminPassengers />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/rides">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminRides />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminUsers />
          </AppLayout>
        </ProtectedRoute>
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
