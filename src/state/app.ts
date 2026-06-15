import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { DashboardTab } from "../types/app";

export const selectedUserIdAtom = atomWithStorage("reliability-selected-user-id", "");
export const selectedFromAtom = atomWithStorage("reliability-selected-from", "");
export const selectedToAtom = atomWithStorage("reliability-selected-to", "");
export const activeTabAtom = atom<DashboardTab>("overview");
export const liveModeAtom = atomWithStorage("reliability-live-mode", false);
export const liveTourSeenAtom = atomWithStorage("reliability-live-tour-seen", false);
