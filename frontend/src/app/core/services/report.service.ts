import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EstateSummary, Contribution, Payment, PaymentStatus, PageResponse, StatementEntry } from '../models';

export interface PaymentFilters {
  status?: PaymentStatus | '';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export type PaymentTotals = Record<PaymentStatus, { count: number; total: number }>;

@Injectable({ providedIn: 'root' })
export class ReportService {
  private base = `${environment.apiUrl}/api/admin/reports`;

  constructor(private http: HttpClient) {}

  getSummary() {
    return this.http.get<EstateSummary>(`${this.base}/summary`);
  }

  getTotalOutstanding() {
    return this.http.get<number>(`${this.base}/total-outstanding`);
  }

  getUnsettled() {
    return this.http.get<Contribution[]>(`${this.base}/unsettled`);
  }

  /** Contributions filterable by settled state (paid vs unpaid), period, and due-date range. */
  getContributions(filters: { settled?: boolean; period?: string; from?: string; to?: string } = {}) {
    let params = new HttpParams();
    if (filters.settled != null) params = params.set('settled', String(filters.settled));
    if (filters.period) params = params.set('period', filters.period);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<Contribution[]>(`${this.base}/contributions`, { params });
  }

  getPayments(filters: PaymentFilters = {}) {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 0))
      .set('size', String(filters.size ?? 20));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<PageResponse<Payment>>(`${this.base}/payments`, { params });
  }

  getPaymentTotals(filters: { from?: string; to?: string } = {}) {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<PaymentTotals>(`${this.base}/payments/totals`, { params });
  }

  getMemberStatement(userId: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<StatementEntry[]>(`${this.base}/members/${userId}/statement`, { params });
  }
}
