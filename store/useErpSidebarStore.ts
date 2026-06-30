import { create } from "zustand";

type ErpSidebarState = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (v: boolean) => void;
};

export const useErpSidebarStore = create<ErpSidebarState>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (v) => set({ isCollapsed: v }),
  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
  setMobileOpen: (v) => set({ isMobileOpen: v }),
}));
