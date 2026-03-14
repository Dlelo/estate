import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card" style="max-width:500px">
        <div class="auth-logo">
          <div class="logo-circle">🏘️</div>
          <h4>Create Account</h4>
          <p>Join your estate community</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label">First Name</label>
              <input type="text" class="form-control" formControlName="firstName"
                placeholder="John" [class.is-invalid]="touched('firstName')">
              @if (touched('firstName')) {
                <div class="invalid-feedback">Required</div>
              }
            </div>
            <div class="col-6">
              <label class="form-label">Last Name</label>
              <input type="text" class="form-control" formControlName="lastName"
                placeholder="Doe" [class.is-invalid]="touched('lastName')">
              @if (touched('lastName')) {
                <div class="invalid-feedback">Required</div>
              }
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Phone Number</label>
            <div class="input-group">
              <span class="input-group-text">📱</span>
              <input type="tel" class="form-control" formControlName="phoneNumber"
                placeholder="0712345678" [class.is-invalid]="touched('phoneNumber')">
            </div>
            @if (touched('phoneNumber')) {
              <div class="invalid-feedback d-block">Valid phone number required</div>
            }
          </div>

          <div class="mb-3">
            <label class="form-label">House Number <span class="text-muted">(optional)</span></label>
            <input type="text" class="form-control" formControlName="houseNumber" placeholder="e.g. A12">
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-group-text">🔒</span>
              <input [type]="showPass() ? 'text' : 'password'" class="form-control"
                formControlName="password" placeholder="Min 6 characters"
                [class.is-invalid]="touched('password')">
              <button type="button" class="btn btn-outline-secondary" (click)="togglePass()">
                {{ showPass() ? '🙈' : '👁️' }}
              </button>
            </div>
            @if (touched('password')) {
              <div class="invalid-feedback d-block">Minimum 6 characters required</div>
            }
          </div>

          <div class="mb-4">
            <label class="form-label">Confirm Password</label>
            <input type="password" class="form-control" formControlName="confirmPassword"
              placeholder="Re-enter password"
              [class.is-invalid]="form.hasError('mismatch') && form.get('confirmPassword')?.touched">
            @if (form.hasError('mismatch') && form.get('confirmPassword')?.touched) {
              <div class="invalid-feedback d-block">Passwords do not match</div>
            }
          </div>

          @if (error()) {
            <div class="alert alert-danger py-2 mb-3">{{ error() }}</div>
          }

          <button type="submit" class="btn btn-primary w-100 py-2 mb-3" [disabled]="loading()">
            @if (loading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
            Create Account
          </button>

          <p class="text-center text-muted-sm">
            Already have an account? <a routerLink="/login" class="fw-semibold">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  `
})
export class RegisterComponent {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  showPass = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.minLength(10)]],
      houseNumber: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatch });
  }

  togglePass() { this.showPass.set(!this.showPass()); }

  passwordMatch(g: FormGroup) {
    const p = g.get('password')?.value;
    const c = g.get('confirmPassword')?.value;
    return p === c ? null : { mismatch: true };
  }

  touched(f: string) { const c = this.form.get(f); return c?.invalid && c?.touched; }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { confirmPassword, ...req } = this.form.value;
    this.auth.register(req).subscribe({
      next: () => {
        this.toast.success('Account created! Please log in.');
        this.router.navigate(['/login']);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Registration failed. Please try again.');
      }
    });
  }
}
