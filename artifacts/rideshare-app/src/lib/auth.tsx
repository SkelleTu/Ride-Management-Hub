import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  selectedRole: UserRole | null;
  setSelectedRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [selectedRole, setSelectedRoleState] = useState<UserRole | null>(
    (localStorage.getItem("selectedRole") as UserRole) || null
  );
  
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: me, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: 2,
      retryDelay: 3000,
    },
    request: {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (me) {
      setUser(me);
    }
  }, [me]);

  useEffect(() => {
    if (error) {
      // Only force logout on actual auth failures (401/403), not network/server errors
      const status = (error as any)?.status;
      if (status === 401 || status === 403) {
        handleLogout();
      }
      // For network errors or server errors, keep the session alive
    }
  }, [error]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    queryClient.clear();
    setLocation("/");
  };

  const logoutAndClear = () => {
    if (token) {
      logoutMutation.mutate(undefined, {
        onSettled: handleLogout
      });
    } else {
      handleLogout();
    }
  };

  const setSelectedRole = (role: UserRole) => {
    localStorage.setItem("selectedRole", role);
    setSelectedRoleState(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading && !!token,
        login,
        logout: logoutAndClear,
        selectedRole,
        setSelectedRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
