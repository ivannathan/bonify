import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { DashboardTab } from "../types";

export const selectedUserIdAtom = atom("");
export const selectedFromAtom = atom("");
export const activeTabAtom = atom<DashboardTab>("overview");
export const liveModeAtom = atomWithStorage("reliability-live-mode", false);
export const liveTourSeenAtom = atomWithStorage("reliability-live-tour-seen", false);
