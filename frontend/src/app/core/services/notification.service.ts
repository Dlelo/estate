import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs/operators';

export type NotificationType = 'INFO' | 'WARNING' | 'ALERT' | 'PAYMENT_REMINDER';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  sentBy?: string;
}

export interface SendNotificationRequest {
  userId?: number | null;
  title: string;
  message: string;
  type: NotificationType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private base = `${environment.apiUrl}/api/notifications`;
  unreadCount = signal(0);

  constructor(private http: HttpClient) {}

  getForUser(userId: number) {
    return this.http.get<AppNotification[]>(`${this.base}/user/${userId}`);
  }

  refreshUnread(userId: number) {
    this.http.get<{ count: number }>(`${this.base}/user/${userId}/unread-count`)
      .subscribe({ next: r => this.unreadCount.set(r.count), error: () => {} });
  }

  markRead(id: number) {
    return this.http.patch<void>(`${this.base}/${id}/read`, null).pipe(
      tap(() => this.unreadCount.update(c => Math.max(0, c - 1)))
    );
  }

  markAllRead(userId: number) {
    return this.http.patch<void>(`${this.base}/user/${userId}/read-all`, null).pipe(
      tap(() => this.unreadCount.set(0))
    );
  }

  send(req: SendNotificationRequest) {
    return this.http.post<{ sent: number; message: string }>(`${this.base}/send`, req);
  }
}
