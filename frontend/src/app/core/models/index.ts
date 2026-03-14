// ── Auth ──────────────────────────────────────────────────────────────
export interface LoginRequest {
  phoneNumber: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  houseNumber?: string;
}

export interface AuthResponse {
  token: string;
}

export interface JwtPayload {
  sub: string;       // phone number
  roles: string;     // comma-separated, e.g. "ADMIN,MEMBER"
  iat: number;
  exp: number;
}

// ── User ──────────────────────────────────────────────────────────────
export interface User {
  id: number;
  fullName: string;
  phoneNumber: string;
  houseNumber?: string;
  active: boolean;
  roles: Role[] | string[];   // admin endpoint returns string[], JWT uses Role[]
  createdAt?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface UpdateUserRequest {
  fullName: string;
  houseNumber?: string;
  active: boolean;
}

export interface UpdateUserRolesRequest {
  roles: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ── Contribution Type ─────────────────────────────────────────────────
export type ContributionFrequency = 'MONTHLY' | 'ANNUAL' | 'ONE_TIME';

export interface ContributionType {
  id: number;
  name: string;
  amount: number;
  frequency: ContributionFrequency;
  active: boolean;
}

// ── Contribution ──────────────────────────────────────────────────────
export interface Contribution {
  id: number;
  user: User;
  contributionType: ContributionType;
  amount: number;
  paidAmount: number;
  balance: number;
  period: string;   // e.g. "2026-01"
  settled: boolean;
  createdAt?: string;
  payments?: Payment[];
}

// ── Payment ───────────────────────────────────────────────────────────
export type PaymentMethod = 'MPESA' | 'BANK';

export interface Payment {
  id: number;
  user?: User;
  contribution?: Contribution;
  amount: number;
  method: PaymentMethod;
  transactionReference?: string;
  createdAt?: string;
}

export interface PaymentRequest {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

// ── Reports ───────────────────────────────────────────────────────────
export interface EstateSummary {
  totalCollected: number;
  totalOutstanding: number;
  unpaidCount: number;
}

// ── UI helpers ────────────────────────────────────────────────────────
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface FilterState {
  period?: string;
  settled?: boolean | null;
  search?: string;
  categoryId?: number | null;
}
