import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContributionService } from '../../core/services/contribution.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { KshCurrencyPipe } from '../../shared/pipes/ksh-currency.pipe';
import { Contribution } from '../../core/models';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type PayStep = 'mpesa' | 'confirm';
type PayMode = 'single' | 'bulk';

@Component({
  selector: 'app-pending',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KshCurrencyPipe],
  template: `
    <!-- Hero Banner -->
    <div class="pending-hero mb-4">
      <div class="d-flex align-items-center gap-3">
        <div class="hero-icon">⚠️</div>
        <div>
          <h4 class="mb-0 fw-bold text-white">Pending Contributions</h4>
          <div style="color:rgba(255,255,255,.75);font-size:.88rem">
            You have <strong>{{ pending().length }}</strong> unsettled contribution(s) totalling
            <strong>{{ totalOwed() | ksh }}</strong>
          </div>
        </div>
        @if (!loading() && pending().length) {
          <button class="btn btn-light ms-auto fw-semibold" (click)="payAll()">
            💳 Pay All Outstanding
          </button>
        }
      </div>
    </div>

    @if (loading()) {
      <div class="text-center py-5">
        <div class="spinner-border text-primary" style="width:3rem;height:3rem"></div>
        <p class="mt-3 text-muted">Loading your contributions…</p>
      </div>
    } @else if (!pending().length) {
      <div class="panel">
        <div class="panel-body text-center py-5">
          <div style="font-size:4rem">🎉</div>
          <h5 class="mt-2">All caught up!</h5>
          <p class="text-muted">You have no pending contributions.</p>
        </div>
      </div>
    } @else {
      <!-- Group by Category -->
      @for (group of grouped(); track group.category) {
        <div class="panel mb-3">
          <div class="panel-header">
            <span style="font-size:1.3rem">{{ typeIcon(group.category) }}</span>
            <h5>{{ group.category }}</h5>
            <span class="badge ms-2"
              [class.bg-primary]="group.frequency==='MONTHLY'"
              [class.bg-warning]="group.frequency==='ANNUAL'"
              [class.text-dark]="group.frequency==='ANNUAL'">
              {{ group.frequency }}
            </span>
            <div class="ms-auto d-flex align-items-center gap-2 flex-wrap">
              <span class="text-danger fw-bold">{{ group.totalBalance | ksh }} due</span>
              <button class="btn btn-sm btn-primary" (click)="openPay(group.items[0])">Pay Now</button>
              @if (group.frequency === 'MONTHLY' && group.items.length >= 3) {
                <button class="btn btn-sm btn-outline-primary" title="Pay 3 months at once"
                  (click)="openBulkPay(group.items.slice(0, 3))">
                  Pay 3M ({{ bulkTotal(group.items, 3) | ksh }})
                </button>
              }
              @if (group.frequency === 'MONTHLY' && group.items.length >= 6) {
                <button class="btn btn-sm btn-outline-danger" title="Pay all outstanding months"
                  (click)="openBulkPay(group.items)">
                  Pay All {{ group.items.length }}M ({{ group.totalBalance | ksh }})
                </button>
              }
            </div>
          </div>
          <div class="panel-body p-0">
            <div class="table-responsive">
              <table class="table table-modern mb-0">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Amount Due</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of group.items; track c.id) {
                    <tr>
                      <td><span class="font-mono fw-semibold">{{ c.period }}</span></td>
                      <td>{{ c.amount | ksh }}</td>
                      <td class="text-success">{{ c.paidAmount | ksh }}</td>
                      <td class="text-danger fw-bold">{{ c.balance | ksh }}</td>
                      <td>
                        @if (c.paidAmount > 0) {
                          <span class="badge-partial">Partial</span>
                        } @else {
                          <span class="badge-unpaid">Unpaid</span>
                        }
                      </td>
                      <td>
                        <button class="btn btn-sm btn-outline-primary" (click)="openPay(c)">
                          💳 Pay
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <!-- Balance bar -->
            <div class="px-4 py-3">
              <div class="d-flex justify-content-between text-muted-sm mb-1">
                <span>Payment progress</span>
                <span>{{ group.paidPct }}% paid</span>
              </div>
              <div class="progress">
                <div class="progress-bar bg-success" [style.width]="group.paidPct + '%'"></div>
              </div>
            </div>
          </div>
        </div>
      }
    }

    <!-- ── BULK PAYMENT MODAL ────────────────────────────────────────── -->
    @if (bulkItems().length) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.55)">
        <div class="modal-dialog modal-dialog-centered" style="max-width:500px">
          <div class="modal-content">
            <div class="modal-header" style="background:linear-gradient(135deg,#1a5276,#2e86c1);color:#fff;border-radius:16px 16px 0 0">
              <div>
                <h5 class="modal-title mb-0">💳 Bulk Payment</h5>
                <small style="opacity:.8">{{ bulkItems().length }} months · {{ bulkItems()[0]?.contributionType?.name }}</small>
              </div>
              <button type="button" class="btn-close btn-close-white" (click)="closeBulkModal()"></button>
            </div>

            <!-- Summary bar -->
            <div class="px-4 pt-3 pb-2" style="background:#f8f9fa;border-bottom:1px solid #eee">
              <div class="row text-center g-0">
                <div class="col-4">
                  <div class="text-muted-sm">Months</div>
                  <div class="fw-bold">{{ bulkItems().length }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted-sm">Per Month</div>
                  <div class="fw-bold">{{ (bulkItems()[0]?.amount ?? 0) | ksh }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted-sm">Total Due</div>
                  <div class="fw-bold text-danger">{{ bulkTotal(bulkItems(), bulkItems().length) | ksh }}</div>
                </div>
              </div>
              <!-- Periods list -->
              <div class="mt-2 d-flex gap-1 flex-wrap">
                @for (c of bulkItems(); track c.id) {
                  <span class="badge bg-light text-dark border font-mono" style="font-size:.72rem">{{ c.period }}</span>
                }
              </div>
            </div>

            <div class="modal-body px-4 py-3">

              @if (bulkPayStep() === 'mpesa') {
                <form [formGroup]="mpesaForm">
                  <div class="mpesa-logo-bar mb-3">
                    <div class="mpesa-badge">M-PESA</div>
                    <span class="text-muted-sm">Safaricom Kenya</span>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">M-Pesa Phone Number</label>
                    <div class="input-group">
                      <span class="input-group-text">🇰🇪 +254</span>
                      <input type="tel" class="form-control" formControlName="phone"
                        placeholder="7XXXXXXXX"
                        [class.is-invalid]="mpesaForm.get('phone')?.invalid && mpesaForm.get('phone')?.touched">
                    </div>
                    @if (mpesaForm.get('phone')?.invalid && mpesaForm.get('phone')?.touched) {
                      <div class="text-danger mt-1" style="font-size:.8rem">Enter a valid Safaricom number</div>
                    }
                  </div>
                  <div class="alert alert-success py-2" style="font-size:.82rem">
                    💡 Total of <strong>{{ bulkTotal(bulkItems(), bulkItems().length) | ksh }}</strong> will be charged via M-Pesa STK Push.
                  </div>
                </form>
              }

              @if (bulkPayStep() === 'confirm') {
                <div class="text-center py-2">
                  <div style="font-size:3rem">📱</div>
                  <h6 class="mt-2 fw-bold">Confirm Bulk M-Pesa Payment</h6>
                  <div class="bg-light rounded p-3 text-start mt-3">
                    <table class="table table-sm table-borderless mb-0">
                      <tr><td class="text-muted-sm">Category</td><td class="fw-semibold">{{ bulkItems()[0]?.contributionType?.name }}</td></tr>
                      <tr><td class="text-muted-sm">Months</td><td class="fw-semibold">{{ bulkItems().length }} months</td></tr>
                      <tr><td class="text-muted-sm">Method</td><td class="fw-semibold">📱 M-Pesa</td></tr>
                      <tr><td class="text-muted-sm">Total</td><td class="fw-bold text-primary" style="font-size:1.1rem">{{ bulkTotal(bulkItems(), bulkItems().length) | ksh }}</td></tr>
                      <tr><td class="text-muted-sm">Phone</td><td class="font-mono">+254{{ mpesaForm.value.phone }}</td></tr>
                    </table>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer">
              @if (bulkPayStep() === 'mpesa') {
                <button class="btn btn-outline-secondary" (click)="closeBulkModal()">Cancel</button>
                <button class="btn btn-primary" (click)="nextBulkStep()">Continue ›</button>
              } @else {
                <button class="btn btn-outline-secondary" (click)="bulkPayStep.set('mpesa')">‹ Back</button>
                <button class="btn btn-primary" (click)="submitBulkPayment()" [disabled]="payLoading()">
                  @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Confirm & Pay {{ bulkTotal(bulkItems(), bulkItems().length) | ksh }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── PAYMENT MODAL ──────────────────────────────────────────────── -->
    @if (payingContrib()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.55)">
        <div class="modal-dialog modal-dialog-centered" style="max-width:460px">
          <div class="modal-content">

            <!-- Header -->
            <div class="modal-header" style="background:var(--primary);color:#fff;border-radius:16px 16px 0 0">
              <div>
                <h5 class="modal-title mb-0">💳 Make Payment</h5>
                <small style="opacity:.8">{{ payingContrib()!.contributionType.name }} · {{ payingContrib()!.period }}</small>
              </div>
              <button type="button" class="btn-close btn-close-white" (click)="closeModal()"></button>
            </div>

            <!-- Amount summary bar -->
            <div class="px-4 pt-3 pb-2" style="background:#f8f9fa;border-bottom:1px solid #eee">
              <div class="row text-center g-0">
                <div class="col-4">
                  <div class="text-muted-sm">Due</div>
                  <div class="fw-bold">{{ payingContrib()!.amount | ksh }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted-sm">Paid</div>
                  <div class="fw-bold text-success">{{ payingContrib()!.paidAmount | ksh }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted-sm">Balance</div>
                  <div class="fw-bold text-danger">{{ payingContrib()!.balance | ksh }}</div>
                </div>
              </div>
            </div>

            <div class="modal-body px-4 py-3">

              <!-- STEP 1: M-Pesa details -->
              @if (payStep() === 'mpesa') {
                <form [formGroup]="mpesaForm">
                  <div class="mpesa-logo-bar mb-3">
                    <div class="mpesa-badge">M-PESA</div>
                    <span class="text-muted-sm">Safaricom Kenya</span>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">M-Pesa Phone Number</label>
                    <div class="input-group">
                      <span class="input-group-text">🇰🇪 +254</span>
                      <input type="tel" class="form-control" formControlName="phone"
                        placeholder="7XXXXXXXX"
                        [class.is-invalid]="mpesaForm.get('phone')?.invalid && mpesaForm.get('phone')?.touched">
                    </div>
                    @if (mpesaForm.get('phone')?.invalid && mpesaForm.get('phone')?.touched) {
                      <div class="text-danger mt-1" style="font-size:.8rem">Enter a valid Safaricom number</div>
                    }
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Amount (KSh)</label>
                    <input type="number" class="form-control" formControlName="amount"
                      [max]="payingContrib()!.balance"
                      [class.is-invalid]="mpesaForm.get('amount')?.invalid && mpesaForm.get('amount')?.touched">
                    <div class="form-text">Max: {{ payingContrib()!.balance | ksh }}</div>
                    @if (mpesaForm.get('amount')?.invalid && mpesaForm.get('amount')?.touched) {
                      <div class="text-danger" style="font-size:.8rem">Enter a valid amount</div>
                    }
                  </div>
                  <div class="alert alert-success py-2" style="font-size:.82rem">
                    💡 An STK Push will be sent to your phone. Enter your M-Pesa PIN to confirm.
                  </div>
                </form>
              }

              <!-- STEP 2: Confirm -->
              @if (payStep() === 'confirm') {
                <div class="text-center py-2">
                  <div style="font-size:3rem">📱</div>
                  <h6 class="mt-2 fw-bold">Confirm M-Pesa Payment</h6>
                  <div class="bg-light rounded p-3 text-start mt-3">
                    <table class="table table-sm table-borderless mb-0">
                      <tr><td class="text-muted-sm">Category</td><td class="fw-semibold">{{ payingContrib()!.contributionType.name }}</td></tr>
                      <tr><td class="text-muted-sm">Period</td><td class="fw-semibold">{{ payingContrib()!.period }}</td></tr>
                      <tr><td class="text-muted-sm">Method</td><td class="fw-semibold">📱 M-Pesa</td></tr>
                      <tr><td class="text-muted-sm">Amount</td><td class="fw-bold text-primary" style="font-size:1.1rem">{{ mpesaForm.value.amount | ksh }}</td></tr>
                      <tr><td class="text-muted-sm">Phone</td><td class="font-mono">+254{{ mpesaForm.value.phone }}</td></tr>
                    </table>
                  </div>
                </div>
              }

            </div><!-- /modal-body -->

            <div class="modal-footer">
              @if (payStep() === 'mpesa') {
                <button class="btn btn-outline-secondary" (click)="closeModal()">Cancel</button>
                <button class="btn btn-primary" (click)="nextStep()">Continue ›</button>
              } @else {
                <button class="btn btn-outline-secondary" (click)="payStep.set('mpesa')">‹ Back</button>
                <button class="btn btn-primary" (click)="submitPayment()" [disabled]="payLoading()">
                  @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Confirm & Pay {{ mpesaForm.value.amount | ksh }}
                </button>
              }
            </div>

          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .pending-hero {
      background: linear-gradient(135deg, #c0392b, #e74c3c);
      border-radius: 14px;
      padding: 24px 28px;
    }
    .hero-icon { font-size: 2.5rem; }

    /* Payment method buttons */
    .pay-method-btn {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; border-radius: 12px;
      border: 2px solid #e9ecef; background: #fff;
      cursor: pointer; transition: all .2s; text-align: left; width: 100%;
      &:hover { border-color: var(--primary-light); background: #f0f8ff; }
      .method-icon { font-size: 1.8rem; }
      .method-info { flex: 1;
        .method-name { font-weight: 600; font-size: .95rem; }
        .method-desc { font-size: .78rem; color: #7f8c8d; }
      }
      .method-arrow { font-size: 1.4rem; color: #bdc3c7; }
      &.mpesa:hover { border-color: #00ab00; background: #f0fff0; }
      &.card:hover  { border-color: #1a5276; background: #f0f8ff; }
      &.bank:hover  { border-color: #8e44ad; background: #faf0ff; }
    }

    .mpesa-logo-bar {
      display: flex; align-items: center; gap: 10px;
      .mpesa-badge {
        background: #00ab00; color: #fff;
        font-weight: 700; font-size: .85rem;
        padding: 4px 12px; border-radius: 6px;
      }
    }

    .card-logo-badge {
      padding: 3px 10px; border-radius: 4px; font-size: .72rem; font-weight: 700;
      &.visa { background: #1a1f71; color: #fff; }
      &.mc   { background: #eb001b; color: #fff; }
      &.amex { background: #007bc1; color: #fff; }
    }

    .bank-details { border-left: 4px solid #8e44ad; font-size: .88rem; }
  `]
})
export class PendingComponent implements OnInit {
  pending = signal<Contribution[]>([]);
  loading = signal(true);
  payingContrib = signal<Contribution | null>(null);
  payStep = signal<PayStep>('mpesa');
  payLoading = signal(false);

  // Bulk pay
  bulkItems = signal<Contribution[]>([]);
  bulkPayStep = signal<PayStep>('mpesa');

  mpesaForm: FormGroup;

  totalOwed = computed(() => this.pending().reduce((s, c) => s + c.balance, 0));

  grouped = computed(() => {
    const map = new Map<string, { category: string; frequency: string; items: Contribution[]; totalBalance: number; totalAmount: number; paidPct: number }>();
    for (const c of this.pending()) {
      const key = c.contributionType.name;
      if (!map.has(key)) {
        map.set(key, { category: key, frequency: c.contributionType.frequency, items: [], totalBalance: 0, totalAmount: 0, paidPct: 0 });
      }
      const g = map.get(key)!;
      g.items.push(c);
      g.totalBalance += c.balance;
      g.totalAmount += c.amount;
    }
    map.forEach(g => {
      const paid = g.totalAmount - g.totalBalance;
      g.paidPct = g.totalAmount > 0 ? Math.round((paid / g.totalAmount) * 100) : 0;
    });
    return Array.from(map.values());
  });

  constructor(
    private fb: FormBuilder,
    private contribSvc: ContributionService,
    private auth: AuthService,
    private toast: ToastService
  ) {
    this.mpesaForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^7\d{8}$/)]],
      amount: [0, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    const uid = this.auth.getUserIdFromToken() ?? 1;
    this.loading.set(true);
    this.contribSvc.getPending(uid).subscribe({
      next: d => { this.pending.set(d); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load pending contributions'); }
    });
  }

  openPay(c: Contribution) {
    this.payingContrib.set(c);
    this.payStep.set('mpesa');
    this.mpesaForm.patchValue({ amount: c.balance, phone: '' });
  }

  payAll() {
    const first = this.pending()[0];
    if (first) this.openPay(first);
  }

  closeModal() {
    this.payingContrib.set(null);
    this.payStep.set('mpesa');
  }

  nextStep() {
    this.mpesaForm.markAllAsTouched();
    if (this.mpesaForm.invalid) return;
    this.payStep.set('confirm');
  }

  submitPayment() {
    const c = this.payingContrib();
    if (!c) return;
    const amount = this.mpesaForm.value.amount;
    const ref = `+254${this.mpesaForm.value.phone}`;

    this.payLoading.set(true);
    this.contribSvc.pay(c.id, amount, 'MPESA', ref).subscribe({
      next: () => {
        this.payLoading.set(false);
        this.closeModal();
        this.toast.success(`M-Pesa payment of ${new KshCurrencyPipe().transform(amount)} recorded!`);
        this.load();
      },
      error: err => {
        this.payLoading.set(false);
        this.toast.error(err.error?.message ?? 'Payment failed. Please try again.');
      }
    });
  }

  // ── Bulk pay ─────────────────────────────────────────────
  bulkTotal(items: Contribution[], count: number): number {
    return items.slice(0, count).reduce((s, c) => s + c.balance, 0);
  }

  openBulkPay(items: Contribution[]) {
    this.bulkItems.set(items);
    this.bulkPayStep.set('mpesa');
    this.mpesaForm.patchValue({ phone: '' });
  }

  closeBulkModal() {
    this.bulkItems.set([]);
    this.bulkPayStep.set('mpesa');
  }

  nextBulkStep() {
    this.mpesaForm.get('phone')?.markAsTouched();
    if (this.mpesaForm.get('phone')?.invalid) return;
    this.bulkPayStep.set('confirm');
  }

  submitBulkPayment() {
    const items = this.bulkItems();
    if (!items.length) return;
    const ids = items.map(c => c.id);
    const ref = `+254${this.mpesaForm.value.phone}`;

    this.payLoading.set(true);
    this.contribSvc.bulkPay(ids, 'MPESA', ref).subscribe({
      next: () => {
        this.payLoading.set(false);
        this.closeBulkModal();
        const total = new KshCurrencyPipe().transform(items.reduce((s, c) => s + c.balance, 0));
        this.toast.success(`Bulk payment of ${total} for ${items.length} month(s) recorded!`);
        this.load();
      },
      error: err => {
        this.payLoading.set(false);
        this.toast.error(err.error?.message ?? 'Bulk payment failed. Please try again.');
      }
    });
  }

  typeIcon(name: string) {
    const n = name.toLowerCase();
    if (n.includes('garbage') || n.includes('waste')) return '🗑️';
    if (n.includes('security') || n.includes('guard')) return '🔐';
    if (n.includes('fence') || n.includes('fencing')) return '🚧';
    if (n.includes('road')) return '🛣️';
    if (n.includes('light')) return '💡';
    if (n.includes('water') || n.includes('bore')) return '💧';
    return '🏘️';
  }
}
