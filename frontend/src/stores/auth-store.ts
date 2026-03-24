import { useSyncExternalStore } from "react";
import type { User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;
}

let authState: AuthState = {
  token: localStorage.getItem("access_token"),
  user: null,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return authState;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function setAuth(token: string, user: User) {
  localStorage.setItem("access_token", token);
  authState = { token, user };
  emitChange();
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  authState = { token: null, user: null };
  emitChange();
}

export function useAuthStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    token: state.token,
    user: state.user,
    isAuthenticated: !!state.token,
    setAuth,
    clearAuth,
  };
}
