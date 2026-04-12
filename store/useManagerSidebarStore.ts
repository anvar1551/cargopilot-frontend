import { create } from "zustand";

type ManagerSidebarState = {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

export const useManagerSidebarStore = create<ManagerSidebarState>((set) => ({
  isCollapsed: false,
  toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (v) => set({ isCollapsed: v }),
}));
