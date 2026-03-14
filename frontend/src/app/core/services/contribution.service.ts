import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Contribution, Payment } from '../models';

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

  generateForPeriod(period: string) {
    return this.http.post<string>(
      `${this.base}/admin/generate`, null,
      { params: new HttpParams().set('period', period), responseType: 'text' as any }
    );
  }
}
