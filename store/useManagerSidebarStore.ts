import { create } from "zustand";

type ManagerSidebarState = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (v: boolean) => void;
};

export const useManagerSidebarStore = create<ManagerSidebarState>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (v) => set({ isCollapsed: v }),
  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
  setMobileOpen: (v) => set({ isMobileOpen: v }),
}));
