import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-circle">🏘️</div>
          <h4>EstateManager</h4>
          <p>Sign in to your account</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="mb-3">
            <label class="form-label">Phone Number</label>
            <div class="input-group">
              <span class="input-group-text">📱</span>
              <input type="tel" class="form-control" formControlName="phoneNumber"
                placeholder="e.g. 0712345678"
                [class.is-invalid]="touched('phoneNumber')">
            </div>
            @if (touched('phoneNumber')) {
              <div class="invalid-feedback d-block">Please enter a valid phone number</div>
            }
          </div>

          <div class="mb-4">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-group-text">🔒</span>
              <input [type]="showPass() ? 'text' : 'password'" class="form-control"
                formControlName="password" placeholder="Your password"
                [class.is-invalid]="touched('password')">
              <button type="button" class="btn btn-outline-secondary" (click)="togglePass()">
                {{ showPass() ? '🙈' : '👁️' }}
              </button>
            </div>
            @if (touched('password')) {
              <div class="invalid-feedback d-block">Password is required</div>
            }
          </div>

          @if (sessionExpired()) {
            <div class="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
              <span>⏰</span>
              <span>Your session has expired. Please sign in again.</span>
            </div>
          }

          @if (error()) {
            <div class="alert alert-danger py-2 mb-3">{{ error() }}</div>
          }

          <button type="submit" class="btn btn-primary w-100 py-2 mb-3" [disabled]="loading()">
            @if (loading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
            Sign In
          </button>

          <p class="text-center text-muted-sm">
            Don't have an account? <a routerLink="/register" class="fw-semibold">Register here</a>
          </p>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  showPass = signal(false);
  sessionExpired = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      phoneNumber: ['', [Validators.required, Validators.minLength(10)]],
      password: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.sessionExpired.set(this.route.snapshot.queryParamMap.get('reason') === 'expired');
  }

  togglePass() { this.showPass.set(!this.showPass()); }

  touched(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.value).subscribe({
      next: () => {
        this.toast.success('Welcome back!');
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Invalid credentials. Please try again.');
      }
    });
  }
}
