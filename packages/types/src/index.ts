// ─── Enums ─────────────────────────────────────────────────────────────────

export type UserRole = 'platform_admin' | 'bus_owner' | 'driver' | 'display' | 'esp32' | 'advertiser';

export type BusStatus = 'active' | 'inactive' | 'maintenance';

export type SessionStatus = 'active' | 'paused' | 'ended';

export type AdFormat = 'banner' | 'fullscreen';

export type AdStatus = 'draft' | 'active' | 'paused' | 'exhausted' | 'ended';

export type CampaignTargetType = 'all' | 'route' | 'district' | 'bus';

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export type StopSubmissionStatus = 'pending' | 'approved' | 'rejected';

export type AudioEventType = 'silent' | 'disconnected' | 'reconnected';

// ─── Shared Entities ────────────────────────────────────────────────────────

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy?: number;    // metres
  speed?: number;       // m/s
  heading?: number;     // degrees
  timestamp: number;    // unix ms
}

export interface Stop {
  id: string;
  orgId: string;
  name: string;           // English
  nameMl: string;         // Malayalam
  lat: number;
  lng: number;
  audioUrl: string | null;
  geofenceRadius: number; // metres (default 50)
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  orgId: string;
  name: string;
  nameMl: string;
  districtId: string;
  stops: RouteStop[];
  createdAt: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  stopId: string;
  order: number;
  stop: Stop;
}

export interface Bus {
  id: string;
  orgId: string;
  numberPlate: string;
  name: string | null;
  status: BusStatus;
  currentRouteId: string | null;
  currentDriverId: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastSeen: string | null;
}

export interface District {
  id: string;
  name: string;
  nameMl: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface JourneySession {
  id: string;
  busId: string;
  driverId: string;
  routeId: string;
  currentStopIndex: number;
  status: SessionStatus;
  pairingCode: string | null;
  startedAt: string;
  endedAt: string | null;
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export interface Advertisement {
  id: string;
  campaignId: string;
  format: AdFormat;
  mediaUrl: string;
  durationSeconds: number;
  targetType: CampaignTargetType;
  targetIds: string[];
}

export interface AdCampaign {
  id: string;
  advertiserId: string;
  name: string;
  status: AdStatus;
  advertiserCpm: number;
  ownerCpm: number;
  totalBudget: number;
  spentAmount: number;
  startsAt: string | null;
  endsAt: string | null;
  timeFrom: string | null; // HH:MM
  timeTo: string | null;   // HH:MM
}

// ─── Socket.IO Events (Server → Client) ──────────────────────────────────────

export interface S2C_Events {
  // Display receives these
  'display:stop_advance': { sessionId: string; stopIndex: number; stop: Stop; nextStop: Stop | null };
  'display:stop_undo': { sessionId: string; stopIndex: number; stop: Stop; nextStop: Stop | null };
  'display:announce': { sessionId: string; stop: Stop };
  'display:ad_play': { ad: Advertisement };
  'display:session_start': { session: JourneySession; route: Route };
  'display:session_end': { sessionId: string };
  'display:gps_update': GpsPoint;

  // Driver receives these
  'driver:paired': { sessionId: string; busId: string; route: Route; currentStopIndex: number };
  'driver:stop_update': { stopIndex: number; stop: Stop; nextStop: Stop | null };
  'driver:error': { code: string; message: string };

  // Admin receives these
  'admin:bus_update': { bus: Bus };
  'admin:gps_update': { busId: string; point: GpsPoint };
  'admin:audio_event': { busId: string; event: AudioEventType; sessionId: string; stopName: string };
  'admin:audio_chunk': { busId: string; chunk: string }; // base64 PCM
}

// ─── Socket.IO Events (Client → Server) ──────────────────────────────────────

export interface C2S_Events {
  // Driver sends
  'driver:gps': GpsPoint & { busId: string; sessionId: string };
  'driver:forward': { sessionId: string };
  'driver:undo': { sessionId: string };
  'driver:announce': { sessionId: string };
  'driver:pair': { pairingCode: string; driverId: string };
  'driver:end_session': { sessionId: string };

  // Display sends
  'display:register': { busId: string; token: string };
  'display:impression': ImpressionPayload;
  'display:audio_chunk': { busId: string; sessionId: string; chunk: string };
  'display:audio_event': { busId: string; sessionId: string; event: AudioEventType; stopName: string };

  // ESP32 (LAN only) — mirrored to cloud by display
  'esp32:button': { button: 'forward' | 'undo' | 'announce'; busId: string };

  // Admin
  'admin:subscribe_fleet': {};
  'admin:listen_bus': { busId: string };
  'admin:unlisten_bus': { busId: string };
}

// ─── Impression payload ───────────────────────────────────────────────────────

export interface ImpressionPayload {
  adId: string;
  campaignId: string;
  busId: string;
  sessionId: string;
  routeId: string;
  districtId: string;
  format: AdFormat;
  durationSeconds: number;
  advertisedAt: string; // ISO
}

// ─── Local WebSocket (LAN between Display ↔ ESP32 / Driver Phone) ─────────────

export interface LanMessage {
  type: 'btn' | 'gps' | 'heartbeat' | 'ack' | 'session';
  button?: 'forward' | 'undo' | 'announce';
  point?: GpsPoint;
  sessionId?: string;
  ts: number;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface RevenueConfig {
  id: string;
  defaultAdvertiserCpm: number;
  defaultOwnerCpm: number;
  updatedAt: string;
}

export interface OwnerEarnings {
  orgId: string;
  totalEarned: number;
  totalPaid: number;
  balance: number;
}

// ─── Pairing ─────────────────────────────────────────────────────────────────

export interface PairingState {
  code: string;
  busId: string;
  displaySocketId: string;
  expiresAt: number; // unix ms
}

// ─── Stop submission (driver maps new place) ──────────────────────────────────

export interface StopSubmission {
  id: string;
  orgId: string;
  submittedByDriverId: string;
  nameDraft: string;
  lat: number;
  lng: number;
  status: StopSubmissionStatus;
  reviewedByAdminId: string | null;
  nameApproved: string | null;
  nameMlApproved: string | null;
  audioUrl: string | null;
  createdAt: string;
}
