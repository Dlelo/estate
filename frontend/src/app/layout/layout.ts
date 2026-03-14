import { Component, signal, computed, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

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

    <!-- Sidebar overlay for mobile -->
    <div class="sidebar-overlay" [class.show]="sidebarOpen()" (click)="sidebarOpen.set(false)"></div>

    <!-- Sidebar -->
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
      <a class="nav-item-link" routerLink="/contributions" routerLinkActive="active" (click)="closeSidebar()">
        <span class="nav-icon">💳</span> My Contributions
      </a>

      @if (auth.isAdmin()) {
        <div class="nav-section-label">Admin</div>
        <a class="nav-item-link" routerLink="/admin/users" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">👥</span> Users
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
        @if (auth.isAdmin()) { <span style="color:#e67e22;font-size:.72rem;font-weight:600;">ADMIN</span> }
      </div>
    </nav>

    <!-- Topbar -->
    <header class="topbar">
      <button class="hamburger" (click)="toggleSidebar()">☰</button>
      <span class="topbar-title">{{ pageTitle() }}</span>
      <div class="topbar-actions">
        <div class="avatar sm bg-primary">{{ initials() }}</div>
      </div>
    </header>

    <!-- Content -->
    <main class="main-content">
      <div class="page-container">
        <router-outlet />
      </div>
    </main>
  `
})
export class LayoutComponent {
  sidebarOpen = signal(false);

  constructor(public auth: AuthService, public toastSvc: ToastService) {}

  pageTitle = computed(() => {
    const path = window.location.pathname;
    if (path.includes('dashboard'))        return 'Dashboard';
    if (path.includes('contributions'))    return 'My Contributions';
    if (path.includes('admin/users'))      return 'User Management';
    if (path.includes('admin/reports'))    return 'Reports & Analytics';
    if (path.includes('profile'))          return 'My Profile';
    return 'Estate Manager';
  });

  initials = computed(() => {
    const phone = this.auth.currentUser()?.phoneNumber ?? '';
    return phone ? phone.slice(-2).toUpperCase() : 'U';
  });

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }

  toastIcon(type: string) {
    return type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  }

  closeSidebar() { this.sidebarOpen.set(false); }

  logout() { this.auth.logout(); }

  @HostListener('window:resize')
  onResize() { if (window.innerWidth > 768) this.sidebarOpen.set(false); }
}
