import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Contribution, Payment, PaymentStatus } from '../models';

export interface StkPushResponse {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

@Injectable({ providedIn: 'root' })
export class ContributionService {
  private base = `${environment.apiUrl}/api/contributions`;

  constructor(private http: HttpClient) {}

  getByUser(userId: number) {
    return this.http.get<Contribution[]>(`${this.base}/user/${userId}`);
  }

  getPending(userId: number) {
    return this.http.get<Contribution[]>(`${this.base}/user/${userId}/pending`);
  }

  pay(contributionId: number, amount: number, method: string, reference?: string) {
    let params = new HttpParams()
      .set('amount', amount)
      .set('method', method);
    if (reference) params = params.set('reference', reference);
    return this.http.post<Payment>(`${this.base}/${contributionId}/pay`, null, { params });
  }

  bulkPay(ids: number[], method: string, reference?: string) {
    return this.http.post<any[]>(`${this.base}/bulk-pay`, { ids, method, reference });
  }

  initiateStkPush(contributionId: number, phoneNumber: string) {
    return this.http.post<StkPushResponse>(`${this.base}/${contributionId}/stk-push`, { phoneNumber });
  }

  initiateBulkStkPush(contributionIds: number[], phoneNumber: string) {
    return this.http.post<StkPushResponse>(`${this.base}/bulk-stk-push`, { contributionIds, phoneNumber });
  }

  getPaymentStatus(checkoutRequestId: string) {
    return this.http.get<{ status: PaymentStatus }>(
      `${environment.apiUrl}/api/payments/status/${checkoutRequestId}`
    );
  }

  getPaybillInfo() {
    return this.http.get<{ paybillNumber: string }>(`${environment.apiUrl}/api/payments/paybill-info`);
  }

  generateForPeriod(period: string) {
    return this.http.post<{ period: string; count: number; contributions: Contribution[] }>(
      `${this.base}/admin/generate`, null,
      { params: new HttpParams().set('period', period) }
    );
  }
}
