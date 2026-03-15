import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { NotificationService, SendNotificationRequest, NotificationType } from '../../../core/services/notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { User } from '../../../core/models';

type Modal = 'edit' | 'roles' | 'notify' | 'notifyAll' | 'reminders' | null;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgTemplateOutlet],
  template: `
    <!-- Stats Bar -->
    <div class="row g-3 mb-4">
      <div class="col-sm-3">
        <div class="summary-card primary">
          <div class="card-icon">👥</div>
          <div class="card-label">Total Members</div>
          <div class="card-value">{{ totalElements() }}</div>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="summary-card success">
          <div class="card-icon">✅</div>
          <div class="card-label">Active</div>
          <div class="card-value">{{ activeCount() }}</div>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="summary-card warning">
          <div class="card-icon">📦</div>
          <div class="card-label">Archived</div>
          <div class="card-value">{{ archivedCount() }}</div>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="summary-card info">
          <div class="card-icon">🛡️</div>
          <div class="card-label">Admins</div>
          <div class="card-value">{{ adminCount() }}</div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="panel mb-3">
      <div class="panel-body">
        <div class="row g-2 align-items-end">
          <div class="col-sm-4">
            <label class="form-label">Search</label>
            <input type="text" class="form-control" [(ngModel)]="searchName"
              (ngModelChange)="search()" placeholder="Name or phone…">
          </div>
          <div class="col-sm-2">
            <label class="form-label">Status</label>
            <select class="form-select" [(ngModel)]="searchActive" (ngModelChange)="search()">
              <option [ngValue]="null">All</option>
              <option [ngValue]="true">Active</option>
              <option [ngValue]="false">Archived</option>
            </select>
          </div>
          <div class="col-sm-2">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-outline-secondary d-block w-100" (click)="clearSearch()">Clear</button>
          </div>
          <div class="col-sm-4 text-sm-end d-flex gap-2 justify-content-sm-end">
            <button class="btn btn-danger fw-semibold" (click)="openModal('reminders', null)">
              💳 Send Reminders
            </button>
            <button class="btn btn-warning fw-semibold" (click)="openModal('notifyAll', null)">
              📢 Broadcast
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="panel">
      <div class="panel-header">
        <span>👥</span><h5>Estate Members</h5>
        <span class="ms-auto badge bg-secondary">{{ totalElements() }} total</span>
      </div>
      <div class="panel-body p-0">
        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!users().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">👥</div>
            <p>No members found</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>House</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th style="min-width:220px">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr [class.table-light]="!u.active">
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <div class="avatar sm" [style.background]="avatarColor(u.fullName)">
                          {{ initials(u.fullName) }}
                        </div>
                        <div>
                          <div class="fw-semibold">{{ u.fullName }}</div>
                          <div class="text-muted-sm">#{{ u.id }}</div>
                        </div>
                      </div>
                    </td>
                    <td>{{ u.phoneNumber }}</td>
                    <td>{{ u.houseNumber || '—' }}</td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        @for (r of roleNames(u); track r) {
                          <span class="badge"
                            [class.bg-warning]="r==='ADMIN'" [class.text-dark]="r==='ADMIN'"
                            [class.bg-secondary]="r!=='ADMIN'">
                            {{ r }}
                          </span>
                        }
                      </div>
                    </td>
                    <td>
                      @if (u.active) {
                        <span class="badge-settled">Active</span>
                      } @else {
                        <span class="badge-unpaid">Archived</span>
                      }
                    </td>
                    <td class="text-muted-sm">{{ u.createdAt | date:'mediumDate' }}</td>
                    <td>
                      <div class="d-flex gap-1 flex-wrap">
                        <!-- Edit -->
                        <button class="btn btn-icon btn-outline-primary" title="Edit profile"
                          (click)="openModal('edit', u)">✏️</button>
                        <!-- Roles -->
                        <button class="btn btn-icon btn-outline-warning" title="Manage roles"
                          (click)="openModal('roles', u)">🛡️</button>
                        <!-- Archive / Activate -->
                        @if (u.active) {
                          <button class="btn btn-icon btn-outline-secondary" title="Archive member"
                            (click)="archiveUser(u)">📦</button>
                        } @else {
                          <button class="btn btn-icon btn-outline-success" title="Activate member"
                            (click)="activateUser(u)">✅</button>
                        }
                        <!-- Notify -->
                        <button class="btn btn-icon btn-outline-info" title="Send notification"
                          (click)="openModal('notify', u)">🔔</button>
                        <!-- Delete -->
                        <button class="btn btn-icon btn-outline-danger" title="Delete"
                          (click)="confirmDelete(u)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          <div class="d-flex justify-content-between align-items-center p-3 border-top">
            <span class="text-muted-sm">
              Page {{ currentPage() + 1 }} of {{ totalPages() }} · {{ totalElements() }} members
            </span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" [disabled]="currentPage()===0"
                (click)="goPage(currentPage()-1)">‹ Prev</button>
              <button class="btn btn-sm btn-outline-secondary"
                [disabled]="currentPage() >= totalPages()-1"
                (click)="goPage(currentPage()+1)">Next ›</button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ── EDIT MODAL ──────────────────────────────────────────── -->
    @if (activeModal() === 'edit' && selectedUser()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">✏️ Edit Member</h5>
              <button type="button" class="btn-close" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded">
                <div class="avatar md" [style.background]="avatarColor(selectedUser()!.fullName)">
                  {{ initials(selectedUser()!.fullName) }}
                </div>
                <div>
                  <div class="fw-semibold">{{ selectedUser()!.fullName }}</div>
                  <div class="text-muted-sm">{{ selectedUser()!.phoneNumber }}</div>
                </div>
              </div>
              <form [formGroup]="editForm">
                <div class="mb-3">
                  <label class="form-label">Full Name</label>
                  <input type="text" class="form-control" formControlName="fullName"
                    [class.is-invalid]="editForm.get('fullName')?.invalid && editForm.get('fullName')?.touched">
                  <div class="invalid-feedback">Full name is required</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">House Number</label>
                  <input type="text" class="form-control" formControlName="houseNumber"
                    placeholder="e.g. A12">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" (click)="saveEdit()" [disabled]="actionLoading()">
                @if (actionLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── ROLES MODAL ─────────────────────────────────────────── -->
    @if (activeModal() === 'roles' && selectedUser()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">🛡️ Manage Roles</h5>
              <button type="button" class="btn-close" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded">
                <div class="avatar md" [style.background]="avatarColor(selectedUser()!.fullName)">
                  {{ initials(selectedUser()!.fullName) }}
                </div>
                <div>
                  <div class="fw-semibold">{{ selectedUser()!.fullName }}</div>
                  <div class="text-muted-sm">Current roles: {{ roleNames(selectedUser()!).join(', ') }}</div>
                </div>
              </div>
              <p class="text-muted-sm mb-3">Select the roles to assign to this member:</p>
              <div class="d-flex flex-column gap-2">
                @for (role of availableRoles; track role.name) {
                  <label class="role-toggle-card" [class.selected]="selectedRoles.has(role.name)">
                    <input type="checkbox" class="form-check-input me-3"
                      [checked]="selectedRoles.has(role.name)"
                      (change)="toggleRole(role.name)">
                    <div>
                      <div class="fw-semibold">{{ role.icon }} {{ role.name }}</div>
                      <div class="text-muted-sm">{{ role.desc }}</div>
                    </div>
                  </label>
                }
              </div>
              @if (!selectedRoles.size) {
                <div class="alert alert-warning py-2 mt-3" style="font-size:.82rem">
                  ⚠️ At least one role must be selected.
                </div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" (click)="saveRoles()"
                [disabled]="actionLoading() || !selectedRoles.size">
                @if (actionLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Update Roles
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── NOTIFY SINGLE MODAL ──────────────────────────────────── -->
    @if (activeModal() === 'notify' && selectedUser()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header" style="background:var(--primary);color:#fff;border-radius:16px 16px 0 0">
              <h5 class="modal-title">🔔 Send Notification</h5>
              <button type="button" class="btn-close btn-close-white" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex align-items-center gap-2 mb-4 p-2 bg-light rounded">
                <span>To:</span>
                <div class="avatar sm" [style.background]="avatarColor(selectedUser()!.fullName)">
                  {{ initials(selectedUser()!.fullName) }}
                </div>
                <strong>{{ selectedUser()!.fullName }}</strong>
                <span class="text-muted-sm">{{ selectedUser()!.phoneNumber }}</span>
              </div>
              <ng-container *ngTemplateOutlet="notifyForm"></ng-container>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" (click)="sendNotification()" [disabled]="actionLoading()">
                @if (actionLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── BROADCAST MODAL ──────────────────────────────────────── -->
    @if (activeModal() === 'notifyAll') {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header" style="background:#e67e22;color:#fff;border-radius:16px 16px 0 0">
              <h5 class="modal-title">📢 Broadcast to All Members</h5>
              <button type="button" class="btn-close btn-close-white" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-warning py-2 mb-4" style="font-size:.82rem">
                📢 This message will be sent to <strong>all {{ activeCount() }} active members</strong>.
              </div>
              <ng-container *ngTemplateOutlet="notifyForm"></ng-container>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-warning fw-semibold" (click)="sendNotification()" [disabled]="actionLoading()">
                @if (actionLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                📢 Broadcast to All
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── PAYMENT REMINDERS MODAL ──────────────────────────────── -->
    @if (activeModal() === 'reminders') {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header" style="background:#c0392b;color:#fff;border-radius:16px 16px 0 0">
              <h5 class="modal-title">💳 Send Payment Reminders</h5>
              <button type="button" class="btn-close btn-close-white" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-danger py-2 mb-4" style="font-size:.82rem">
                💳 Sends a <strong>PAYMENT_REMINDER</strong> notification to every active member
                who has <strong>unsettled contributions</strong> for the selected period.
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Contribution Period</label>
                <input type="month" class="form-control" [(ngModel)]="reminderPeriod">
                <div class="form-text">Members with unpaid contributions for this month will be notified.</div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-danger fw-semibold" (click)="sendReminders()" [disabled]="actionLoading() || !reminderPeriod">
                @if (actionLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Send Reminders
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Shared notify form template -->
    <ng-template #notifyForm>
      <form [formGroup]="notifyFormGroup">
        <div class="mb-3">
          <label class="form-label">Notification Type</label>
          <div class="d-flex gap-2 flex-wrap">
            @for (t of notifTypes; track t.value) {
              <button type="button" class="btn btn-sm"
                [class.btn-outline-secondary]="notifyFormGroup.value.type !== t.value"
                [ngClass]="notifyFormGroup.value.type === t.value ? t.activeClass : ''"
                (click)="notifyFormGroup.patchValue({type: t.value})">
                {{ t.icon }} {{ t.label }}
              </button>
            }
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Title</label>
          <input type="text" class="form-control" formControlName="title"
            placeholder="e.g. Payment Reminder"
            [class.is-invalid]="notifyFormGroup.get('title')?.invalid && notifyFormGroup.get('title')?.touched">
          <div class="invalid-feedback">Title is required</div>
        </div>
        <div class="mb-3">
          <label class="form-label">Message</label>
          <textarea class="form-control" formControlName="message" rows="3"
            placeholder="Your message here…"
            [class.is-invalid]="notifyFormGroup.get('message')?.invalid && notifyFormGroup.get('message')?.touched">
          </textarea>
          <div class="invalid-feedback">Message is required</div>
        </div>
        <!-- Quick templates -->
        <div class="mb-2">
          <label class="form-label text-muted-sm">Quick templates</label>
          <div class="d-flex gap-2 flex-wrap">
            @for (tpl of msgTemplates; track tpl.title) {
              <button type="button" class="btn btn-xs btn-outline-secondary"
                style="font-size:.72rem;padding:3px 8px"
                (click)="fillTemplate(tpl)">
                {{ tpl.title }}
              </button>
            }
          </div>
        </div>
      </form>
    </ng-template>
  `,
  styles: [`
    .role-toggle-card {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 10px;
      border: 2px solid #e9ecef; cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--primary-light); background: #f0f8ff; }
      &.selected { border-color: var(--primary-light); background: rgba(46,134,193,.08); }
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  totalPages = signal(1);
  currentPage = signal(0);
  activeCount = signal(0);
  archivedCount = signal(0);
  adminCount = signal(0);
  actionLoading = signal(false);
  activeModal = signal<Modal>(null);
  selectedUser = signal<User | null>(null);
  selectedRoles = new Set<string>();

  searchName = '';
  searchActive: boolean | null = null;
  reminderPeriod = new Date().toISOString().slice(0, 7); // default to current month YYYY-MM

  editForm: FormGroup;
  notifyFormGroup: FormGroup;

  availableRoles = [
    { name: 'MEMBER', icon: '👤', desc: 'Standard estate member with basic access' },
    { name: 'ADMIN',  icon: '🛡️', desc: 'Full administrative access to all features' },
  ];

  notifTypes = [
    { value: 'INFO',             label: 'Info',      icon: 'ℹ️', activeClass: 'btn-info text-white' },
    { value: 'WARNING',          label: 'Warning',   icon: '⚠️', activeClass: 'btn-warning' },
    { value: 'ALERT',            label: 'Alert',     icon: '🚨', activeClass: 'btn-danger' },
    { value: 'PAYMENT_REMINDER', label: 'Payment',   icon: '💳', activeClass: 'btn-primary' },
  ];

  msgTemplates = [
    { title: 'Payment Due',    type: 'PAYMENT_REMINDER' as NotificationType, msg: 'Your monthly contribution is due. Please make payment at your earliest convenience.' },
    { title: 'Overdue',        type: 'ALERT'            as NotificationType, msg: 'Your estate contributions are overdue. Please settle your outstanding balance to avoid penalties.' },
    { title: 'Meeting Notice', type: 'INFO'             as NotificationType, msg: 'There is an estate residents meeting scheduled. Please check the notice board for details.' },
    { title: 'Maintenance',    type: 'WARNING'          as NotificationType, msg: 'Planned maintenance work will be carried out in the estate. Some services may be temporarily unavailable.' },
  ];

  constructor(
    private fb: FormBuilder,
    private userSvc: UserService,
    private notifSvc: NotificationService,
    private toast: ToastService
  ) {
    this.editForm = this.fb.group({
      fullName: ['', Validators.required],
      houseNumber: [''],
    });
    this.notifyFormGroup = this.fb.group({
      type: ['INFO', Validators.required],
      title: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.userSvc.getUsers({ name: this.searchName || undefined, active: this.searchActive, page: this.currentPage(), size: 15 }).subscribe({
      next: page => {
        this.users.set(page.content);
        this.totalElements.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
        this.computeStats(page.content);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load members'); }
    });
    // Also load stats totals
    this.userSvc.getUsers({ size: 200 }).subscribe({ next: p => this.computeStats(p.content), error: () => {} });
  }

  computeStats(users: User[]) {
    this.activeCount.set(users.filter(u => u.active).length);
    this.archivedCount.set(users.filter(u => !u.active).length);
    this.adminCount.set(users.filter(u => this.roleNames(u).includes('ADMIN')).length);
  }

  search() { this.currentPage.set(0); this.load(); }
  clearSearch() { this.searchName = ''; this.searchActive = null; this.search(); }
  goPage(p: number) { this.currentPage.set(p); this.load(); }

  openModal(modal: Modal, user: User | null) {
    this.activeModal.set(modal);
    this.selectedUser.set(user);
    this.actionLoading.set(false);

    if (modal === 'edit' && user) {
      this.editForm.patchValue({ fullName: user.fullName, houseNumber: user.houseNumber ?? '' });
    }
    if (modal === 'roles' && user) {
      this.selectedRoles = new Set(this.roleNames(user));
    }
    if (modal === 'notify' || modal === 'notifyAll') {
      this.notifyFormGroup.reset({ type: 'INFO', title: '', message: '' });
    }
  }

  closeModal() { this.activeModal.set(null); this.selectedUser.set(null); }

  toggleRole(name: string) {
    this.selectedRoles.has(name) ? this.selectedRoles.delete(name) : this.selectedRoles.add(name);
  }

  fillTemplate(tpl: { title: string; type: NotificationType; msg: string }) {
    this.notifyFormGroup.patchValue({ type: tpl.type, title: tpl.title, message: tpl.msg });
  }

  saveEdit() {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const u = this.selectedUser()!;
    this.actionLoading.set(true);
    this.userSvc.updateUser(u.id, { ...this.editForm.value, active: u.active }).subscribe({
      next: () => { this.actionLoading.set(false); this.closeModal(); this.toast.success('Member updated'); this.load(); },
      error: err => { this.actionLoading.set(false); this.toast.error(err.error?.message ?? 'Update failed'); }
    });
  }

  saveRoles() {
    if (!this.selectedRoles.size) return;
    const u = this.selectedUser()!;
    this.actionLoading.set(true);
    this.userSvc.updateRoles(u.id, { roles: Array.from(this.selectedRoles) }).subscribe({
      next: () => { this.actionLoading.set(false); this.closeModal(); this.toast.success('Roles updated'); this.load(); },
      error: err => { this.actionLoading.set(false); this.toast.error(err.error?.message ?? 'Role update failed'); }
    });
  }

  sendNotification() {
    this.notifyFormGroup.markAllAsTouched();
    if (this.notifyFormGroup.invalid) return;
    const modal = this.activeModal();
    const { type, title, message } = this.notifyFormGroup.value;
    const req: SendNotificationRequest = {
      title, message, type,
      userId: modal === 'notify' ? this.selectedUser()!.id : null
    };
    this.actionLoading.set(true);
    this.notifSvc.send(req).subscribe({
      next: res => {
        this.actionLoading.set(false);
        this.closeModal();
        this.toast.success(res.message ?? 'Notification sent');
      },
      error: err => { this.actionLoading.set(false); this.toast.error(err.error?.message ?? 'Failed to send'); }
    });
  }

  archiveUser(u: User) {
    if (!confirm(`Archive "${u.fullName}"? They won't be able to log in.`)) return;
    this.userSvc.archive(u.id).subscribe({
      next: () => { this.toast.success(`${u.fullName} archived`); this.load(); },
      error: () => this.toast.error('Failed to archive member')
    });
  }

  activateUser(u: User) {
    this.userSvc.activate(u.id).subscribe({
      next: () => { this.toast.success(`${u.fullName} reactivated`); this.load(); },
      error: () => this.toast.error('Failed to activate member')
    });
  }

  confirmDelete(u: User) {
    if (!confirm(`Permanently delete "${u.fullName}"? This cannot be undone.`)) return;
    this.userSvc.deleteUser(u.id).subscribe({
      next: () => { this.toast.success('Member deleted'); this.load(); },
      error: () => this.toast.error('Failed to delete member')
    });
  }

  sendReminders() {
    if (!this.reminderPeriod) return;
    this.actionLoading.set(true);
    this.notifSvc.remindUnpaid(this.reminderPeriod).subscribe({
      next: res => {
        this.actionLoading.set(false);
        this.closeModal();
        this.toast.success(res.message ?? `Reminders sent to ${res.reminded} member(s)`);
      },
      error: err => { this.actionLoading.set(false); this.toast.error(err.error?.message ?? 'Failed to send reminders'); }
    });
  }

  roleNames(u: User): string[] {
    if (!u.roles?.length) return [];
    return (u.roles as any[]).map(r => typeof r === 'string' ? r : r.name);
  }

  initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  avatarColor(name: string): string {
    const colors = ['#2e86c1','#e67e22','#1e8449','#8e44ad','#c0392b','#16a085','#2c3e50'];
    const idx = (name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % colors.length;
    return colors[idx];
  }
}
