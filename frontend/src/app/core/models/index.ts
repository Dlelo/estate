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
  email?: string;
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
  email?: string;
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
  email?: string;
}

export interface UpdateUserRolesRequest {
  roles: string[];
}

export interface UpdateSelfRequest {
  fullName: string;
  houseNumber?: string;
  email?: string;
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
  dueDay?: number;
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
  dueDate?: string;
  settled: boolean;
  createdAt?: string;
  payments?: Payment[];
}

// ── Payment ───────────────────────────────────────────────────────────
export type PaymentMethod = 'MPESA' | 'PAYBILL' | 'BANK';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

export interface Payment {
  id: number;
  user?: User;
  contribution?: Contribution;
  amount: number;
  method: PaymentMethod;
  transactionReference?: string;
  status: PaymentStatus;
  checkoutRequestId?: string;
  resultDesc?: string;
  createdAt?: string;
}

export interface PaymentRequest {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

// ── Statement ─────────────────────────────────────────────────────────
export interface StatementEntry {
  date: string;
  type: 'CHARGE' | 'PAYMENT';
  description: string;
  dueDate?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  method?: PaymentMethod;
  transactionReference?: string;
  status?: string;
  notes?: string;
}

// ── Reports ───────────────────────────────────────────────────────────
export interface EstateSummary {
  totalCollected: number;
  totalOutstanding: number;
  unpaidCount: number;
  /** Of unpaidCount, how many already have an M-Pesa payment awaiting confirmation. */
  unpaidWithPendingPaymentCount: number;
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
