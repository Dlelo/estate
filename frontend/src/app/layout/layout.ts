import { Component, signal, HostListener, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ContributionService } from '../core/services/contribution.service';
import { NotificationService } from '../core/services/notification.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <!-- Toast notifications -->
    <div class="toast-container-fixed">
      @for (t of toastSvc.toasts(); track t.id) {
        <div class="toast-item {{ t.type }}" (click)="toastSvc.dismiss(t.id)">
          <span class="me-2">{{ toastIcon(t.type) }}</span>{{ t.message }}
        </div>
      }
    </div>

    <!-- Mobile overlay -->
    <div class="sidebar-overlay" [class.show]="sidebarOpen()" (click)="closeSidebar()"></div>

    <!-- ── Sidebar ───────────────────────────────────────── -->
    <nav class="sidebar" [class.open]="sidebarOpen()">
      <div class="sidebar-brand">
        <a class="brand-logo" routerLink="/dashboard" (click)="closeSidebar()">
          <span class="icon-badge">🏘️</span>
          <span>EstateManager</span>
        </a>
        <div class="brand-sub">Residential Community</div>
      </div>

      <div class="nav-section-label">Main</div>

      <a class="nav-item-link" routerLink="/dashboard" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">📊</span> Dashboard
      </a>
      <a class="nav-item-link" routerLink="/pending" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">⚠️</span> Pending Payments
        @if (pendingCount() > 0) {
          <span class="badge-count">{{ pendingCount() }}</span>
        }
      </a>
      <a class="nav-item-link" routerLink="/contributions" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">💳</span> All Contributions
      </a>
      <a class="nav-item-link" routerLink="/notifications" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">🔔</span> Notifications
        @if (notifSvc.unreadCount() > 0) {
          <span class="badge-count">{{ notifSvc.unreadCount() }}</span>
        }
      </a>

      @if (auth.isAdmin()) {
        <div class="nav-section-label">Admin</div>
        <a class="nav-item-link" routerLink="/admin/contribution-types" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">📋</span> Categories
        </a>
        <a class="nav-item-link" routerLink="/admin/users" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">👥</span> Members
        </a>
        <a class="nav-item-link" routerLink="/admin/reports" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">📈</span> Reports
        </a>
      }

      <div class="nav-section-label">Account</div>
      <a class="nav-item-link" routerLink="/profile" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">👤</span> Profile
      </a>
      <a class="nav-item-link" (click)="logout()">
        <span class="nav-icon">🚪</span> Logout
      </a>

      <div class="sidebar-footer">
        <div>{{ auth.currentUser()?.phoneNumber }}</div>
        @if (auth.isAdmin()) {
          <span style="color:#e67e22;font-size:.72rem;font-weight:600;">ADMIN</span>
        }
      </div>
    </nav>

    <!-- ── Topbar ────────────────────────────────────────── -->
    <header class="topbar">
      <button class="hamburger" (click)="toggleSidebar()">☰</button>
      <span class="topbar-title">{{ currentTitle() }}</span>

      <div class="topbar-actions">
        <!-- Pending alert pill -->
        @if (pendingCount() > 0) {
          <a routerLink="/pending" class="btn btn-sm btn-danger" style="border-radius:20px;font-size:.78rem">
            ⚠️ {{ pendingCount() }} pending
          </a>
        }

        <!-- Notification bell -->
        <a routerLink="/notifications" class="notif-bell" title="Notifications">
          🔔
          @if (notifSvc.unreadCount() > 0) {
            <span class="notif-badge">{{ notifSvc.unreadCount() }}</span>
          }
        </a>

        <!-- Avatar -->
        <div class="avatar sm bg-primary">{{ initials() }}</div>
      </div>
    </header>

    <!-- ── Page content ──────────────────────────────────── -->
    <main class="main-content">
      <div class="page-container">
        <router-outlet />
      </div>
    </main>
  `,
  styles: [`
    .notif-bell {
      position: relative; font-size: 1.25rem;
      text-decoration: none; cursor: pointer;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; transition: background .15s;
      &:hover { background: #f0f0f0; }
    }
    .notif-badge {
      position: absolute; top: 2px; right: 2px;
      background: #dc3545; color: #fff;
      font-size: .58rem; font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px; padding: 0 4px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }
  `]
})
export class LayoutComponent implements OnInit {
  sidebarOpen = signal(false);
  pendingCount = signal(0);
  currentTitle = signal('Dashboard');

  private readonly titles: Record<string, string> = {
    '/dashboard':                 'Dashboard',
    '/pending':                   'Pending Payments',
    '/contributions':             'All Contributions',
    '/notifications':             'Notifications',
    '/admin/contribution-types':  'Contribution Categories',
    '/admin/users':               'Members',
    '/admin/reports':             'Reports & Analytics',
    '/profile':                   'My Profile',
  };

  constructor(
    public auth: AuthService,
    public toastSvc: ToastService,
    public notifSvc: NotificationService,
    private contribSvc: ContributionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const path = e.urlAfterRedirects ?? e.url;
      const key = Object.keys(this.titles).find(k => path.startsWith(k)) ?? '';
      this.currentTitle.set(this.titles[key] ?? 'Estate Manager');
    });

    const uid = this.auth.getUserIdFromToken();
    if (uid) {
      this.contribSvc.getPending(uid).subscribe({ next: l => this.pendingCount.set(l.length), error: () => {} });
      this.notifSvc.refreshUnread(uid);
    }
  }

  initials() {
    const phone = this.auth.currentUser()?.phoneNumber ?? '';
    return phone ? phone.slice(-2).toUpperCase() : 'U';
  }

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }
  closeSidebar()  { this.sidebarOpen.set(false); }
  toastIcon(t: string) { return t === 'success' ? '✅' : t === 'error' ? '❌' : 'ℹ️'; }
  logout() { this.auth.logout(); }

  @HostListener('window:resize')
  onResize() { if (window.innerWidth > 768) this.sidebarOpen.set(false); }
}
