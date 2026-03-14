import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AppNotification } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row justify-content-center">
      <div class="col-lg-8">

        <!-- Header -->
        <div class="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h5 class="mb-1 fw-bold">🔔 Notifications</h5>
            <div class="text-muted-sm">{{ unreadCount() }} unread of {{ notifications().length }} total</div>
          </div>
          @if (unreadCount() > 0) {
            <button class="btn btn-sm btn-outline-primary" (click)="markAllRead()">
              ✓ Mark all as read
            </button>
          }
        </div>

        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!notifications().length) {
          <div class="panel">
            <div class="panel-body text-center py-5">
              <div style="font-size:3.5rem">🔕</div>
              <h5 class="mt-2">No notifications</h5>
              <p class="text-muted">You're all caught up! Nothing new to show.</p>
            </div>
          </div>
        } @else {
          <div class="d-flex flex-column gap-2">
            @for (n of notifications(); track n.id) {
              <div class="notif-card" [class.unread]="!n.read" (click)="markRead(n)">
                <div class="notif-icon" [ngClass]="iconClass(n.type)">{{ typeIcon(n.type) }}</div>
                <div class="notif-body">
                  <div class="d-flex justify-content-between align-items-start">
                    <div class="notif-title" [class.fw-bold]="!n.read">{{ n.title }}</div>
                    @if (!n.read) { <span class="unread-dot"></span> }
                  </div>
                  <div class="notif-message">{{ n.message }}</div>
                  <div class="notif-meta">
                    <span>{{ n.createdAt | date:'MMM d, y · h:mm a' }}</span>
                    @if (n.sentBy) { <span class="ms-2">· from {{ n.sentBy }}</span> }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .notif-card {
      display: flex; gap: 14px; align-items: flex-start;
      background: #fff; border-radius: 12px;
      padding: 16px; border: 1.5px solid #f0f0f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(0,0,0,.08); }
      &.unread { border-left: 4px solid var(--primary-light); background: #f8fbff; }
    }
    .notif-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
      &.info     { background: rgba(23,162,184,.12); }
      &.warning  { background: rgba(255,193,7,.15); }
      &.alert    { background: rgba(220,53,69,.1); }
      &.payment  { background: rgba(46,134,193,.12); }
    }
    .notif-body { flex: 1; min-width: 0; }
    .notif-title { font-size: .92rem; }
    .notif-message { font-size: .84rem; color: #555; margin-top: 3px; line-height: 1.4; }
    .notif-meta { font-size: .74rem; color: #95a5a6; margin-top: 6px; }
    .unread-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--primary-light); flex-shrink: 0; margin-top: 5px;
    }
  `]
})
export class NotificationsComponent implements OnInit {
  notifications = signal<AppNotification[]>([]);
  loading = signal(true);
  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  constructor(
    private notifSvc: NotificationService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() { this.load(); }

  load() {
    const uid = this.auth.getUserIdFromToken();
    if (!uid) return;
    this.loading.set(true);
    this.notifSvc.getForUser(uid).subscribe({
      next: data => { this.notifications.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load notifications'); }
    });
  }

  markRead(n: AppNotification) {
    if (n.read) return;
    this.notifSvc.markRead(n.id).subscribe({
      next: () => {
        this.notifications.update(list => list.map(x => x.id === n.id ? { ...x, read: true } : x));
        this.notifSvc.unreadCount.update(c => Math.max(0, c - 1));
      }
    });
  }

  markAllRead() {
    const uid = this.auth.getUserIdFromToken();
    if (!uid) return;
    this.notifSvc.markAllRead(uid).subscribe({
      next: () => {
        this.notifications.update(list => list.map(x => ({ ...x, read: true })));
        this.notifSvc.unreadCount.set(0);
        this.toast.success('All notifications marked as read');
      }
    });
  }

  typeIcon(type: string) {
    return type === 'WARNING' ? '⚠️' : type === 'ALERT' ? '🚨' : type === 'PAYMENT_REMINDER' ? '💳' : 'ℹ️';
  }

  iconClass(type: string) {
    return type === 'WARNING' ? 'warning' : type === 'ALERT' ? 'alert' : type === 'PAYMENT_REMINDER' ? 'payment' : 'info';
  }
}
