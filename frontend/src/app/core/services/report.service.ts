import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EstateSummary, Contribution } from '../models';

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
}
