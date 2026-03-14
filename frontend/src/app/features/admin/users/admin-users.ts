import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { User } from '../../../core/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <!-- Search bar -->
    <div class="panel mb-4">
      <div class="panel-body">
        <div class="row g-2 align-items-end">
          <div class="col-sm-4">
            <label class="form-label">Search by Name</label>
            <input type="text" class="form-control" [(ngModel)]="searchName" (ngModelChange)="search()"
              placeholder="John Doe…" [ngModelOptions]="{standalone:true}">
          </div>
          <div class="col-sm-3">
            <label class="form-label">Phone</label>
            <input type="text" class="form-control" [(ngModel)]="searchPhone" (ngModelChange)="search()"
              placeholder="07…" [ngModelOptions]="{standalone:true}">
          </div>
          <div class="col-sm-2">
            <label class="form-label">Status</label>
            <select class="form-select" [(ngModel)]="searchActive" (ngModelChange)="search()"
              [ngModelOptions]="{standalone:true}">
              <option [ngValue]="null">All</option>
              <option [ngValue]="true">Active</option>
              <option [ngValue]="false">Inactive</option>
            </select>
          </div>
          <div class="col-sm-3">
            <button class="btn btn-outline-secondary" (click)="clearSearch()">Clear</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="panel">
      <div class="panel-header">
        <span>👥</span>
        <h5>Estate Residents</h5>
        <span class="ms-auto badge bg-secondary">{{ totalElements() }} users</span>
      </div>
      <div class="panel-body p-0">
        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!users().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">👥</div>
            <p>No users found</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Phone</th>
                  <th>House</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <div class="avatar sm bg-primary">{{ initials(u.fullName) }}</div>
                        <span class="fw-semibold">{{ u.fullName }}</span>
                      </div>
                    </td>
                    <td>{{ u.phoneNumber }}</td>
                    <td>{{ u.houseNumber || '—' }}</td>
                    <td>
                      @for (r of roleNames(u); track r) {
                        <span class="badge me-1"
                          [class.bg-warning]="r==='ADMIN'" [class.text-dark]="r==='ADMIN'"
                          [class.bg-secondary]="r!=='ADMIN'">
                          {{ r }}
                        </span>
                      }
                    </td>
                    <td>
                      <span class="status-dot" [class.active]="u.active" [class.inactive]="!u.active"></span>
                      {{ u.active ? 'Active' : 'Inactive' }}
                    </td>
                    <td class="text-muted-sm">{{ u.createdAt | date:'mediumDate' }}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn btn-icon btn-outline-primary" title="Edit" (click)="openEdit(u)">✏️</button>
                        <button class="btn btn-icon btn-outline-danger" title="Delete" (click)="confirmDelete(u)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          <div class="d-flex justify-content-between align-items-center p-3">
            <span class="text-muted-sm">Page {{ currentPage() + 1 }} of {{ totalPages() }}</span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" [disabled]="currentPage()===0"
                (click)="goPage(currentPage()-1)">‹ Prev</button>
              <button class="btn btn-sm btn-outline-secondary" [disabled]="currentPage()>=totalPages()-1"
                (click)="goPage(currentPage()+1)">Next ›</button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Edit Modal -->
    @if (editingUser()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">✏️ Edit Resident</h5>
              <button type="button" class="btn-close" (click)="editingUser.set(null)"></button>
            </div>
            <div class="modal-body">
              <form [formGroup]="editForm">
                <div class="mb-3">
                  <label class="form-label">Full Name</label>
                  <input type="text" class="form-control" formControlName="fullName"
                    [class.is-invalid]="editForm.get('fullName')?.invalid && editForm.get('fullName')?.touched">
                  <div class="invalid-feedback">Full name is required</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">House Number</label>
                  <input type="text" class="form-control" formControlName="houseNumber">
                </div>
                <div class="mb-3">
                  <label class="form-label d-flex align-items-center gap-2">
                    <input type="checkbox" formControlName="active" class="form-check-input m-0">
                    Active Account
                  </label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="editingUser.set(null)">Cancel</button>
              <button class="btn btn-primary" (click)="saveEdit()" [disabled]="saveLoading()">
                @if (saveLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class AdminUsersComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  totalPages = signal(1);
  currentPage = signal(0);
  editingUser = signal<User | null>(null);
  saveLoading = signal(false);

  searchName = '';
  searchPhone = '';
  searchActive: boolean | null = null;

  editForm: FormGroup;

  constructor(
    private userSvc: UserService,
    private toast: ToastService,
    private fb: FormBuilder
  ) {
    this.editForm = this.fb.group({
      fullName: ['', Validators.required],
      houseNumber: [''],
      active: [true]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.userSvc.getUsers({
      name: this.searchName || undefined,
      phone: this.searchPhone || undefined,
      active: this.searchActive,
      page: this.currentPage(),
      size: 15
    }).subscribe({
      next: page => {
        this.users.set(page.content);
        this.totalElements.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load users'); }
    });
  }

  search() { this.currentPage.set(0); this.load(); }
  clearSearch() { this.searchName=''; this.searchPhone=''; this.searchActive=null; this.search(); }
  goPage(p: number) { this.currentPage.set(p); this.load(); }

  openEdit(u: User) {
    this.editingUser.set(u);
    this.editForm.patchValue({ fullName: u.fullName, houseNumber: u.houseNumber, active: u.active });
  }

  saveEdit() {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const u = this.editingUser()!;
    this.saveLoading.set(true);
    this.userSvc.updateUser(u.id, this.editForm.value).subscribe({
      next: () => {
        this.saveLoading.set(false);
        this.editingUser.set(null);
        this.toast.success('User updated successfully');
        this.load();
      },
      error: err => {
        this.saveLoading.set(false);
        this.toast.error(err.error?.message ?? 'Update failed');
      }
    });
  }

  confirmDelete(u: User) {
    if (!confirm(`Delete user "${u.fullName}"? This cannot be undone.`)) return;
    this.userSvc.deleteUser(u.id).subscribe({
      next: () => { this.toast.success('User deleted'); this.load(); },
      error: () => this.toast.error('Failed to delete user')
    });
  }

  initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  roleNames(u: User): string[] {
    if (!u.roles?.length) return [];
    // roles can be string[] (from UserResponseDTO) or Role[] (from JWT)
    return (u.roles as any[]).map(r => typeof r === 'string' ? r : r.name);
  }
}
