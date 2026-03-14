import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <!-- Profile Card -->
        <div class="panel mb-4">
          <div class="panel-body text-center py-4">
            <div class="avatar lg bg-primary mx-auto mb-3" style="display:flex">
              {{ initials() }}
            </div>
            <h5 class="fw-bold mb-1">{{ profileForm.value.fullName || 'Estate Resident' }}</h5>
            <div class="text-muted-sm">{{ auth.currentUser()?.phoneNumber }}</div>
            @if (auth.isAdmin()) {
              <span class="badge bg-warning text-dark mt-2">Administrator</span>
            }
          </div>
        </div>

        <!-- Edit Form -->
        <div class="panel">
          <div class="panel-header">
            <span>✏️</span><h5>Update Profile</h5>
          </div>
          <div class="panel-body">
            <form [formGroup]="profileForm" (ngSubmit)="save()">
              <div class="mb-3">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" formControlName="fullName"
                  [class.is-invalid]="touched('fullName')" placeholder="John Doe">
                @if (touched('fullName')) {
                  <div class="invalid-feedback">Full name is required</div>
                }
              </div>

              <div class="mb-3">
                <label class="form-label">Phone Number</label>
                <input type="tel" class="form-control" [value]="auth.currentUser()?.phoneNumber" disabled>
                <div class="form-text">Phone number cannot be changed</div>
              </div>

              <div class="mb-4">
                <label class="form-label">House Number</label>
                <input type="text" class="form-control" formControlName="houseNumber" placeholder="e.g. A12, B5">
              </div>

              <div class="divider"></div>

              <h6 class="mb-3">Change Password</h6>

              <div class="mb-3">
                <label class="form-label">New Password <span class="text-muted">(leave blank to keep current)</span></label>
                <div class="input-group">
                  <input [type]="showPass() ? 'text' : 'password'" class="form-control"
                    formControlName="newPassword" placeholder="Min 6 characters">
                  <button type="button" class="btn btn-outline-secondary" (click)="togglePass()">
                    {{ showPass() ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-control" formControlName="confirmPassword"
                  placeholder="Repeat new password"
                  [class.is-invalid]="profileForm.hasError('mismatch') && profileForm.get('confirmPassword')?.touched">
                @if (profileForm.hasError('mismatch') && profileForm.get('confirmPassword')?.touched) {
                  <div class="invalid-feedback d-block">Passwords do not match</div>
                }
              </div>

              @if (error()) {
                <div class="alert alert-danger py-2 mb-3">{{ error() }}</div>
              }

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary" [disabled]="loading()">
                  @if (loading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Save Changes
                </button>
                <button type="button" class="btn btn-outline-secondary" (click)="logout()">
                  🚪 Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileComponent {
  profileForm: FormGroup;
  loading = signal(false);
  error = signal('');
  showPass = signal(false);

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    private userSvc: UserService,
    private toast: ToastService
  ) {
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      houseNumber: [''],
      newPassword: [''],
      confirmPassword: ['']
    }, { validators: this.passwordMatch });
  }

  togglePass() { this.showPass.set(!this.showPass()); }

  passwordMatch(g: FormGroup) {
    const p = g.get('newPassword')?.value;
    const c = g.get('confirmPassword')?.value;
    if (!p) return null;
    return p === c ? null : { mismatch: true };
  }

  touched(f: string) { const c = this.profileForm.get(f); return c?.invalid && c?.touched; }

  initials() {
    const name = this.profileForm.value.fullName ?? '';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  }

  save() {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) return;
    // Note: Profile updates would require a dedicated user profile endpoint
    // For now we show a success toast as the backend may require userId
    this.toast.info('Profile update feature requires backend user profile endpoint.');
  }

  logout() { this.auth.logout(); }
}
