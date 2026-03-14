import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ContributionType } from '../models';

export interface ContributionTypeRequest {
  name: string;
  amount: number;
  frequency: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME';
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ContributionTypeService {
  private base = `${environment.apiUrl}/api/contribution-types`;

  constructor(private http: HttpClient) {}

  getAll()         { return this.http.get<ContributionType[]>(`${this.base}/all`); }
  getActive()      { return this.http.get<ContributionType[]>(this.base); }
  create(r: ContributionTypeRequest) { return this.http.post<ContributionType>(this.base, r); }
  update(id: number, r: ContributionTypeRequest) { return this.http.put<ContributionType>(`${this.base}/${id}`, r); }
  toggleActive(id: number) { return this.http.patch<void>(`${this.base}/${id}/toggle`, null); }
  delete(id: number)       { return this.http.delete<void>(`${this.base}/${id}`); }
}
