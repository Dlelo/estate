import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ContributionService } from '../../core/services/contribution.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { KshCurrencyPipe } from '../../shared/pipes/ksh-currency.pipe';
import { Contribution } from '../../core/models';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type PayMethod = 'MPESA' | 'PAYBILL' | 'BANK';
type StkPhase = 'idle' | 'pushed' | 'completed' | 'failed';

@Component({
  selector: 'app-contributions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KshCurrencyPipe],
  template: `
    <!-- Filter Bar -->
    <div class="panel mb-4">
      <div class="panel-body">
        <form [formGroup]="filterForm" class="row g-2 align-items-end">
          <div class="col-sm-4 col-md-3">
            <label class="form-label">Search Category</label>
            <input type="text" class="form-control" formControlName="search" placeholder="e.g. Garbage">
          </div>
          <div class="col-sm-4 col-md-2">
            <label class="form-label">Period</label>
            <input type="month" class="form-control" formControlName="period">
          </div>
          <div class="col-sm-4 col-md-2">
            <label class="form-label">Status</label>
            <select class="form-select" formControlName="status">
              <option value="">All</option>
              <option value="settled">Settled</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div class="col-md-2">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="clearFilters()">
              Clear
            </button>
          </div>
          <div class="col-md-3 text-md-end">
            <button type="button" class="btn btn-outline-success me-2" (click)="exportCsv()">
              📥 CSV
            </button>
            <button type="button" class="btn btn-outline-danger" (click)="exportPdf()">
              📄 PDF
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Summary pills -->
    <div class="d-flex gap-2 flex-wrap mb-3">
      <span class="badge bg-light text-dark border">
        Total: <strong>{{ filtered().length }}</strong>
      </span>
      <span class="badge bg-success bg-opacity-10 text-success border border-success">
        Paid: {{ totalPaid() | ksh }}
      </span>
      <span class="badge bg-danger bg-opacity-10 text-danger border border-danger">
        Outstanding: {{ totalBalance() | ksh }}
      </span>
    </div>

    <!-- Table -->
    <div class="panel">
      <div class="panel-header">
        <span>💳</span>
        <h5>My Contributions</h5>
        <span class="ms-auto badge bg-secondary">{{ filtered().length }} records</span>
      </div>
      <div class="panel-body p-0">
        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
            <p class="mt-2 text-muted">Loading contributions…</p>
          </div>
        } @else if (!filtered().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">📭</div>
            <p>No contributions match your filters</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Period</th>
                  <th>Frequency</th>
                  <th>Amount Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filtered(); track c.id; let i = $index) {
                  <tr>
                    <td class="text-muted">{{ i + 1 }}</td>
                    <td>
                      <span class="fw-semibold">{{ c.contributionType.name }}</span>
                      <div class="text-muted-sm">{{ getCategoryIcon(c.contributionType.name) }}</div>
                    </td>
                    <td><span class="font-mono">{{ c.period }}</span></td>
                    <td>
                      <span class="badge bg-light text-dark border" style="font-size:.72rem">
                        {{ c.contributionType.frequency }}
                      </span>
                    </td>
                    <td class="fw-semibold">{{ c.amount | ksh }}</td>
                    <td class="text-success">{{ c.paidAmount | ksh }}</td>
                    <td [class.text-danger]="c.balance > 0" [class.text-success]="c.balance === 0">
                      {{ c.balance | ksh }}
                    </td>
                    <td>
                      @if (c.settled) {
                        <span class="badge-settled">✓ Settled</span>
                      } @else if (c.paidAmount > 0) {
                        <span class="badge-partial">~ Partial</span>
                      } @else {
                        <span class="badge-unpaid">✕ Unpaid</span>
                      }
                    </td>
                    <td>
                      <div class="d-flex gap-1">
                        @if (!c.settled) {
                          <button class="btn btn-icon btn-primary text-white"
                            title="Make Payment" (click)="openPay(c)">💳</button>
                        }
                        <button class="btn btn-icon btn-outline-secondary"
                          title="Download Receipt" (click)="downloadReceipt(c)">🧾</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Payment Modal -->
    @if (payingContrib()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">💳 Make Payment</h5>
              <button type="button" class="btn-close" [disabled]="stkPhase() === 'pushed'" (click)="closeModal()"></button>
            </div>
            <div class="modal-body">
              @let c = payingContrib()!;
              <div class="bg-light rounded p-3 mb-3">
                <div class="row g-2 text-sm">
                  <div class="col-6">
                    <div class="text-muted-sm">Category</div>
                    <div class="fw-semibold">{{ c.contributionType.name }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted-sm">Period</div>
                    <div class="fw-semibold font-mono">{{ c.period }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted-sm">Amount Due</div>
                    <div class="fw-semibold">{{ c.amount | ksh }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted-sm">Balance</div>
                    <div class="fw-semibold text-danger">{{ c.balance | ksh }}</div>
                  </div>
                </div>
              </div>

              <!-- Method toggle -->
              <div class="btn-group w-100 mb-3" role="group">
                <button type="button" class="btn"
                  [class.btn-primary]="payMethod() === 'MPESA'" [class.btn-outline-primary]="payMethod() !== 'MPESA'"
                  [disabled]="stkPhase() === 'pushed'"
                  (click)="payMethod.set('MPESA')">📱 STK Push</button>
                <button type="button" class="btn"
                  [class.btn-primary]="payMethod() === 'PAYBILL'" [class.btn-outline-primary]="payMethod() !== 'PAYBILL'"
                  [disabled]="stkPhase() === 'pushed'"
                  (click)="payMethod.set('PAYBILL')">🧾 Paybill</button>
                <button type="button" class="btn"
                  [class.btn-primary]="payMethod() === 'BANK'" [class.btn-outline-primary]="payMethod() !== 'BANK'"
                  [disabled]="stkPhase() === 'pushed'"
                  (click)="payMethod.set('BANK')">🏦 Bank Transfer</button>
              </div>

              @if (payMethod() === 'MPESA') {
                <form [formGroup]="stkForm">
                  <div class="mpesa-logo-bar mb-3">
                    <div class="mpesa-badge">M-PESA</div>
                    <span style="font-size:.8rem;color:#7f8c8d">Safaricom Kenya — paybill STK push</span>
                  </div>

                  @if (stkPhase() === 'idle') {
                    <div class="mb-3">
                      <label class="form-label">Amount (KSh)</label>
                      <input type="number" class="form-control" formControlName="amount"
                        [max]="c.balance" placeholder="Enter amount">
                      <div class="form-text">Max: {{ c.balance | ksh }}</div>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">M-Pesa Phone Number</label>
                      <input type="tel" class="form-control" formControlName="phoneNumber" placeholder="07XXXXXXXX">
                    </div>
                    <div class="alert alert-info py-2" style="font-size:.82rem">
                      💡 You'll get a prompt on your phone to enter your M-Pesa PIN. No need to type a code here —
                      it confirms automatically once you approve it.
                    </div>
                  }

                  @if (stkPhase() === 'pushed') {
                    <div class="text-center py-3">
                      <div class="spinner-border text-primary mb-3"></div>
                      <p class="fw-semibold mb-1">Check your phone</p>
                      <p class="text-muted-sm">{{ stkMessage() }}</p>
                    </div>
                  }

                  @if (stkPhase() === 'completed') {
                    <div class="alert alert-success py-2">✅ Payment confirmed! Balance updated.</div>
                  }

                  @if (stkPhase() === 'failed') {
                    <div class="alert alert-danger py-2">{{ stkMessage() }}</div>
                  }
                </form>
              } @else if (payMethod() === 'PAYBILL') {
                <form [formGroup]="paybillForm">
                  <div class="mpesa-logo-bar mb-3">
                    <div class="mpesa-badge">M-PESA</div>
                    <span style="font-size:.8rem;color:#7f8c8d">Lipa na M-Pesa — Pay Bill</span>
                  </div>

                  <div class="bg-light rounded p-3 mb-3">
                    <div class="row g-2 text-sm">
                      <div class="col-6">
                        <div class="text-muted-sm">Business No. (Paybill)</div>
                        <div class="fw-semibold font-mono">{{ paybillNumber() ?? '—' }}</div>
                      </div>
                      <div class="col-6">
                        <div class="text-muted-sm">Account Number</div>
                        <div class="fw-semibold font-mono">CONTRIB-{{ c.id }}</div>
                      </div>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Amount (KSh)</label>
                    <input type="number" class="form-control" formControlName="amount"
                      [max]="c.balance" placeholder="Enter amount">
                    <div class="form-text">Max: {{ c.balance | ksh }}</div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">M-Pesa Confirmation Code</label>
                    <input type="text" class="form-control" formControlName="reference"
                      placeholder="e.g. QGH3X1ABCD">
                  </div>

                  <div class="alert alert-info py-2" style="font-size:.82rem">
                    💡 Go to M-Pesa → Lipa na M-Pesa → Pay Bill on your phone, enter the business
                    and account numbers above, then come back and enter the confirmation code you receive.
                  </div>
                </form>
              } @else {
                <form [formGroup]="bankForm">
                  <div class="mb-3">
                    <label class="form-label">Amount (KSh)</label>
                    <input type="number" class="form-control" formControlName="amount"
                      [max]="c.balance" placeholder="Enter amount">
                    <div class="form-text">Max: {{ c.balance | ksh }}</div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Bank Reference / Confirmation Code</label>
                    <input type="text" class="form-control" formControlName="reference"
                      placeholder="e.g. bank transaction ref">
                  </div>

                  <div class="alert alert-success py-2" style="font-size:.82rem">
                    💡 Enter the confirmation/reference code from your bank transfer receipt.
                  </div>
                </form>
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" [disabled]="stkPhase() === 'pushed'"
                (click)="closeModal()">{{ stkPhase() === 'completed' ? 'Close' : 'Cancel' }}</button>
              @if (payMethod() === 'MPESA' && stkPhase() === 'idle') {
                <button class="btn btn-primary" (click)="submitStkPush()" [disabled]="payLoading()">
                  @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Send STK Push
                </button>
              }
              @if (payMethod() === 'PAYBILL') {
                <button class="btn btn-primary" (click)="submitPaybillPayment()" [disabled]="payLoading()">
                  @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Submit Payment
                </button>
              }
              @if (payMethod() === 'BANK') {
                <button class="btn btn-primary" (click)="submitBankPayment()" [disabled]="payLoading()">
                  @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                  Submit Payment
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ContributionsComponent implements OnInit, OnDestroy {
  contributions = signal<Contribution[]>([]);
  loading = signal(true);
  payingContrib = signal<Contribution | null>(null);
  payLoading = signal(false);

  payMethod = signal<PayMethod>('MPESA');
  stkPhase = signal<StkPhase>('idle');
  stkMessage = signal('');
  paybillNumber = signal<string | null>(null);
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  filterForm: FormGroup;
  stkForm: FormGroup;
  paybillForm: FormGroup;
  bankForm: FormGroup;

  totalPaid    = computed(() => this.filtered().reduce((s, c) => s + c.paidAmount, 0));
  totalBalance = computed(() => this.filtered().reduce((s, c) => s + c.balance, 0));

  filtered = computed(() => {
    const { search, period, status } = this.filterForm?.value ?? {};
    return this.contributions().filter(c => {
      if (search && !c.contributionType.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (period && c.period !== period) return false;
      if (status === 'settled' && !c.settled) return false;
      if (status === 'partial' && (c.settled || c.paidAmount === 0)) return false;
      if (status === 'unpaid' && c.paidAmount > 0) return false;
      return true;
    });
  });

  constructor(
    private fb: FormBuilder,
    private contribSvc: ContributionService,
    private auth: AuthService,
    private toast: ToastService
  ) {
    this.filterForm = this.fb.group({ search: '', period: '', status: '' });
    this.stkForm = this.fb.group({ amount: [0], phoneNumber: [''] });
    this.paybillForm = this.fb.group({ amount: [0], reference: '' });
    this.bankForm = this.fb.group({ amount: [0], reference: '' });
  }

  ngOnInit() {
    this.load();
    this.contribSvc.getPaybillInfo().subscribe({
      next: res => this.paybillNumber.set(res.paybillNumber),
      error: () => {}
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  load() {
    const userId = this.auth.getUserIdFromToken() ?? 1;
    this.loading.set(true);
    this.contribSvc.getByUser(userId).subscribe({
      next: data => { this.contributions.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load contributions'); }
    });
  }

  clearFilters() { this.filterForm.reset({ search: '', period: '', status: '' }); }

  openPay(c: Contribution) {
    this.payingContrib.set(c);
    this.payMethod.set('MPESA');
    this.stkPhase.set('idle');
    this.stkMessage.set('');
    const myPhone = this.auth.currentUser()?.phoneNumber ?? '';
    this.stkForm.reset({ amount: c.balance, phoneNumber: myPhone });
    this.paybillForm.reset({ amount: c.balance, reference: '' });
    this.bankForm.reset({ amount: c.balance, reference: '' });
  }

  closeModal() {
    this.stopPolling();
    this.payingContrib.set(null);
  }

  submitStkPush() {
    const c = this.payingContrib();
    if (!c) return;
    const { amount, phoneNumber } = this.stkForm.value;
    if (!amount || amount <= 0) { this.toast.error('Enter a valid amount'); return; }
    if (amount > c.balance) { this.toast.error('Amount exceeds balance'); return; }
    if (!phoneNumber) { this.toast.error('Enter the M-Pesa phone number'); return; }

    this.payLoading.set(true);
    this.contribSvc.initiateStkPush(c.id, phoneNumber).subscribe({
      next: res => {
        this.payLoading.set(false);
        this.stkPhase.set('pushed');
        this.stkMessage.set(res.customerMessage || 'Enter your M-Pesa PIN to complete the payment.');
        this.pollStkStatus(res.checkoutRequestId);
      },
      error: err => {
        this.payLoading.set(false);
        this.toast.error(err.error?.message ?? 'Failed to send STK push');
      }
    });
  }

  private pollStkStatus(checkoutRequestId: string, attempt = 0) {
    const MAX_ATTEMPTS = 20; // ~60s at 3s intervals
    this.stopPolling();
    this.pollHandle = setInterval(() => {
      this.contribSvc.getPaymentStatus(checkoutRequestId).subscribe({
        next: res => {
          if (res.status === 'COMPLETED') {
            this.stopPolling();
            this.stkPhase.set('completed');
            this.load();
          } else if (res.status === 'FAILED' || res.status === 'CANCELLED' || res.status === 'TIMEOUT') {
            this.stopPolling();
            this.stkPhase.set('failed');
            this.stkMessage.set(
              res.status === 'CANCELLED' ? 'Payment was cancelled on your phone.' :
              res.status === 'TIMEOUT' ? 'No confirmation received in time. Check your M-Pesa messages — if you paid, it will still reconcile shortly.' :
              'Payment failed. Please try again.'
            );
          } else if (++attempt >= MAX_ATTEMPTS) {
            this.stopPolling();
            this.stkPhase.set('failed');
            this.stkMessage.set('Still waiting on confirmation — check your M-Pesa messages, your balance will update once it lands.');
          }
        },
        error: () => { /* transient — keep polling until MAX_ATTEMPTS */ }
      });
    }, 3000);
  }

  private stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  submitPaybillPayment() {
    const c = this.payingContrib();
    if (!c) return;
    const { amount, reference } = this.paybillForm.value;
    if (!amount || amount <= 0) { this.toast.error('Enter a valid amount'); return; }
    if (amount > c.balance) { this.toast.error('Amount exceeds balance'); return; }
    if (!reference) { this.toast.error('Enter the M-Pesa confirmation code'); return; }
    this.payLoading.set(true);
    this.contribSvc.pay(c.id, amount, 'PAYBILL', reference).subscribe({
      next: () => {
        this.payLoading.set(false);
        this.payingContrib.set(null);
        this.toast.success('Payment recorded successfully!');
        this.load();
      },
      error: err => {
        this.payLoading.set(false);
        this.toast.error(err.error?.message ?? 'Payment failed');
      }
    });
  }

  submitBankPayment() {
    const c = this.payingContrib();
    if (!c) return;
    const { amount, reference } = this.bankForm.value;
    if (!amount || amount <= 0) { this.toast.error('Enter a valid amount'); return; }
    if (amount > c.balance) { this.toast.error('Amount exceeds balance'); return; }
    if (!reference) { this.toast.error('Enter the bank reference/confirmation code'); return; }
    this.payLoading.set(true);
    this.contribSvc.pay(c.id, amount, 'BANK', reference).subscribe({
      next: () => {
        this.payLoading.set(false);
        this.payingContrib.set(null);
        this.toast.success('Payment recorded successfully!');
        this.load();
      },
      error: err => {
        this.payLoading.set(false);
        this.toast.error(err.error?.message ?? 'Payment failed');
      }
    });
  }

  downloadReceipt(c: Contribution) {
    const doc = new jsPDF();
    // Header
    doc.setFillColor(26, 82, 118);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('EstateManager', 14, 18);
    doc.setFontSize(10);
    doc.text('Residential Community Contribution Receipt', 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, 150, 28);

    // Receipt details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('CONTRIBUTION RECEIPT', 14, 55);

    autoTable(doc, {
      startY: 62,
      head: [['Field', 'Details']],
      body: [
        ['Receipt No.',       `RCP-${c.id.toString().padStart(6,'0')}`],
        ['Category',          c.contributionType.name],
        ['Period',            c.period],
        ['Amount Due',        `KSh ${c.amount.toLocaleString('en-KE', {minimumFractionDigits:2})}`],
        ['Amount Paid',       `KSh ${c.paidAmount.toLocaleString('en-KE', {minimumFractionDigits:2})}`],
        ['Balance',           `KSh ${c.balance.toLocaleString('en-KE', {minimumFractionDigits:2})}`],
        ['Status',            c.settled ? 'FULLY SETTLED' : c.paidAmount > 0 ? 'PARTIALLY PAID' : 'UNPAID'],
        ['Payment Frequency', c.contributionType.frequency],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [26, 82, 118] },
      alternateRowStyles: { fillColor: [240, 248, 255] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your contribution to the estate community.', 14, finalY);
    doc.text('This is an auto-generated receipt from EstateManager.', 14, finalY + 6);

    doc.save(`receipt-${c.contributionType.name.replace(/\s/g,'-')}-${c.period}.pdf`);
    this.toast.success('Receipt downloaded!');
  }

  exportCsv() {
    const rows = [['Category','Period','Amount Due','Paid','Balance','Status']];
    this.filtered().forEach(c => rows.push([
      c.contributionType.name,
      c.period,
      c.amount.toString(),
      c.paidAmount.toString(),
      c.balance.toString(),
      c.settled ? 'Settled' : c.paidAmount > 0 ? 'Partial' : 'Unpaid'
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contributions.csv'; a.click();
    URL.revokeObjectURL(url);
    this.toast.success('CSV exported!');
  }

  exportPdf() {
    const doc = new jsPDF();
    doc.setFillColor(26, 82, 118);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16);
    doc.text('Contributions Report', 14, 20);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 30);
    doc.setTextColor(0,0,0);

    autoTable(doc, {
      startY: 45,
      head: [['Category','Period','Amount Due','Paid','Balance','Status']],
      body: this.filtered().map(c => [
        c.contributionType.name,
        c.period,
        `KSh ${c.amount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.paidAmount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.balance.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        c.settled ? 'Settled' : c.paidAmount > 0 ? 'Partial' : 'Unpaid'
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [26, 82, 118] },
      alternateRowStyles: { fillColor: [245, 250, 255] }
    });
    doc.save('contributions-report.pdf');
    this.toast.success('PDF exported!');
  }

  getCategoryIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('garbage')) return '🗑️ Waste Management';
    if (n.includes('security')) return '🔐 Security';
    if (n.includes('fencing') || n.includes('fence')) return '🚧 Fencing';
    if (n.includes('road')) return '🛣️ Road';
    return '🏘️ Estate';
  }
}
