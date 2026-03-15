import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ContributionService } from '../../core/services/contribution.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { KshCurrencyPipe } from '../../shared/pipes/ksh-currency.pipe';
import { Contribution, PaymentMethod } from '../../core/models';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
              <button type="button" class="btn-close" (click)="payingContrib.set(null)"></button>
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

              <form [formGroup]="payForm">
                <div class="mpesa-logo-bar mb-3">
                  <div class="mpesa-badge">M-PESA</div>
                  <span style="font-size:.8rem;color:#7f8c8d">Safaricom Kenya</span>
                </div>

                <div class="mb-3">
                  <label class="form-label">Amount (KSh)</label>
                  <input type="number" class="form-control" formControlName="amount"
                    [max]="c.balance" placeholder="Enter amount">
                  <div class="form-text">Max: {{ c.balance | ksh }}</div>
                </div>

                <div class="mb-3">
                  <label class="form-label">M-Pesa Transaction Code</label>
                  <input type="text" class="form-control" formControlName="reference"
                    placeholder="e.g. QGH3X1ABCD">
                </div>

                <div class="alert alert-success py-2" style="font-size:.82rem">
                  💡 Enter the M-Pesa confirmation code you received after payment.
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" (click)="payingContrib.set(null)">Cancel</button>
              <button class="btn btn-primary" (click)="submitPayment()" [disabled]="payLoading()">
                @if (payLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Submit Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ContributionsComponent implements OnInit {
  contributions = signal<Contribution[]>([]);
  loading = signal(true);
  payingContrib = signal<Contribution | null>(null);
  payLoading = signal(false);

  filterForm: FormGroup;
  payForm: FormGroup;

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
    this.payForm = this.fb.group({ amount: [0], reference: '' });
  }

  ngOnInit() {
    this.load();
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
    this.payForm.patchValue({ method: 'MPESA', amount: c.balance, reference: '' });
  }

  submitPayment() {
    const c = this.payingContrib();
    if (!c) return;
    const { amount, reference } = this.payForm.value;
    if (!amount || amount <= 0) { this.toast.error('Enter a valid amount'); return; }
    if (amount > c.balance) { this.toast.error('Amount exceeds balance'); return; }
    this.payLoading.set(true);
    this.contribSvc.pay(c.id, amount, 'MPESA', reference).subscribe({
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
