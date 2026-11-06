"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore } from "zustand";
import type { CategoryId } from "@/lib/registration";

type RegistrationState = {
  selectedCategories: CategoryId[];
  setSelectedCategories: (categories: CategoryId[]) => void;
};

function createRegistrationStore() {
  return createStore<RegistrationState>()((set) => ({
    selectedCategories: [],
    setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  }));
}
const StoreContext = createContext<ReturnType<typeof createRegistrationStore> | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createRegistrationStore);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useRegistrationStore<T>(selector: (state: RegistrationState) => T) {
  const store = useContext(StoreContext);
  if (!store) throw new Error("RegistrationProvider não está disponível.");
  return useStore(store, selector);
}
