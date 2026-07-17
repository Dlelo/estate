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
            @if (loadingProfile()) {
              <div class="text-center py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Loading profile...
              </div>
            } @else {
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

                <div class="mb-3">
                  <label class="form-label">House Number</label>
                  <input type="text" class="form-control" formControlName="houseNumber" placeholder="e.g. A12, B5">
                </div>

                <div class="mb-4">
                  <label class="form-label">Email <span class="text-muted">(for payment receipts &amp; notifications)</span></label>
                  <input type="email" class="form-control" formControlName="email"
                    [class.is-invalid]="touched('email')" placeholder="you@example.com">
                  @if (touched('email')) {
                    <div class="invalid-feedback">Enter a valid email address</div>
                  }
                </div>

                @if (error()) {
                  <div class="alert alert-danger py-2 mb-3">{{ error() }}</div>
                }

                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-primary" [disabled]="saving()">
                    @if (saving()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                    Save Changes
                  </button>
                  <button type="button" class="btn btn-outline-secondary" (click)="logout()">
                    🚪 Logout
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  loadingProfile = signal(false);
  saving = signal(false);
  error = signal('');

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    private userSvc: UserService,
    private toast: ToastService
  ) {
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      houseNumber: [''],
      email: ['', Validators.email]
    });
  }

  ngOnInit() {
    this.loadingProfile.set(true);
    this.userSvc.getMe().subscribe({
      next: user => {
        this.profileForm.patchValue({
          fullName: user.fullName,
          houseNumber: user.houseNumber ?? '',
          email: user.email ?? ''
        });
        this.loadingProfile.set(false);
      },
      error: err => {
        this.loadingProfile.set(false);
        this.toast.error(err.error?.message ?? 'Failed to load profile.');
      }
    });
  }

  touched(f: string) { const c = this.profileForm.get(f); return c?.invalid && c?.touched; }

  initials() {
    const name = this.profileForm.value.fullName ?? '';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  }

  save() {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) return;

    this.saving.set(true);
    this.error.set('');
    this.userSvc.updateMe(this.profileForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Profile updated successfully.');
      },
      error: err => {
        this.saving.set(false);
        const msg = err.error?.message ?? 'Failed to update profile.';
        this.error.set(msg);
        this.toast.error(msg);
      }
    });
  }

  logout() { this.auth.logout(); }
}
