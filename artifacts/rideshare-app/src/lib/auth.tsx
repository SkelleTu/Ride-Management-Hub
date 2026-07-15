import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const USER_CACHE_KEY = "upcar_user_cache";

function loadCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveCachedUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_CACHE_KEY);
  }
}

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
  const [user, setUser] = useState<User | null>(() => loadCachedUser());
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
      retry: 3,
      retryDelay: 2000,
    },
    request: {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (me) {
      setUser(me);
      saveCachedUser(me);
    }
  }, [me]);

  useEffect(() => {
    if (error) {
      const status = (error as any)?.status;
      if (status === 401 || status === 403) {
        handleLogout();
      }
      // Network/server errors: keep the cached user, don't log out
    }
  }, [error]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    saveCachedUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    saveCachedUser(null);
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

  // isLoading only blocks the UI if we have NO cached user to show
  const resolvedLoading = isLoading && !!token && !user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: resolvedLoading,
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
