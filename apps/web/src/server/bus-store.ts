/**
 * In-memory registry of active bus positions.
 * Updated on every driver:gps event; broadcast to admin fleet room.
 * Cleared when session ends.
 */

export interface BusPosition {
  busId:       string;
  sessionId:   string;
  numberPlate: string;
  routeName:   string;
  routeId:     string;
  driverName:  string;
  currentStop: string | null;
  nextStop:    string | null;
  lat:         number;
  lng:         number;
  speed:       number;        // km/h (0 if unknown)
  heading:     number | null; // degrees 0-360
  accuracy:    number;        // metres
  updatedAt:   number;        // Date.now()
  silentAlert: boolean;
}

const store = new Map<string, BusPosition>();

export const busStore = {
  upsert(pos: BusPosition) {
    store.set(pos.busId, pos);
  },

  remove(busId: string) {
    store.delete(busId);
  },

  get(busId: string): BusPosition | undefined {
    return store.get(busId);
  },

  all(): BusPosition[] {
    return Array.from(store.values());
  },

  active(): BusPosition[] {
    const staleMs = 5 * 60 * 1000; // 5 min
    const now = Date.now();
    return Array.from(store.values()).filter(b => now - b.updatedAt < staleMs);
  },

  setSilentAlert(busId: string, silent: boolean) {
    const b = store.get(busId);
    if (b) store.set(busId, { ...b, silentAlert: silent });
  },

  updateStop(busId: string, currentStop: string | null, nextStop: string | null) {
    const b = store.get(busId);
    if (b) store.set(busId, { ...b, currentStop, nextStop });
  },
};
