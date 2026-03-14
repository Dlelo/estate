import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User, PageResponse, UpdateUserRequest, UpdateUserRolesRequest, Role } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private base = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getUsers(opts: {
    name?: string; phone?: string; active?: boolean | null;
    page?: number; size?: number; sortBy?: string; direction?: string;
  } = {}) {
    let params = new HttpParams();
    if (opts.name)      params = params.set('name', opts.name);
    if (opts.phone)     params = params.set('phone', opts.phone);
    if (opts.active != null) params = params.set('active', String(opts.active));
    params = params
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 20))
      .set('sortBy', opts.sortBy ?? 'fullName')
      .set('direction', opts.direction ?? 'ASC');
    return this.http.get<PageResponse<User>>(this.base, { params });
  }

  updateUser(id: number, req: UpdateUserRequest) {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }

  updateRoles(id: number, req: UpdateUserRolesRequest) {
    return this.http.put<void>(`${this.base}/${id}/roles`, req);
  }

  archive(id: number)  { return this.http.patch<void>(`${this.base}/${id}/archive`, null); }
  activate(id: number) { return this.http.patch<void>(`${this.base}/${id}/activate`, null); }

  deleteUser(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
