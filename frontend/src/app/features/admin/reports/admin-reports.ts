import { Component, OnInit, signal, ViewChild, ElementRef, Injector, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportService, PaymentTotals } from '../../../core/services/report.service';
import { ToastService } from '../../../core/services/toast.service';
import { KshCurrencyPipe } from '../../../shared/pipes/ksh-currency.pipe';
import { Contribution, EstateSummary, Payment, PaymentStatus } from '../../../core/models';
import { periodSortKey } from '../../../shared/period.util';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KshCurrencyPipe],
  template: `
    <!-- Summary Row -->
    @if (summary()) {
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="summary-card success">
            <div class="card-icon">💰</div>
            <div class="card-label">Total Collected</div>
            <div class="card-value">{{ summary()!.totalCollected | ksh }}</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="summary-card danger">
            <div class="card-icon">⚠️</div>
            <div class="card-label">Total Outstanding</div>
            <div class="card-value">{{ summary()!.totalOutstanding | ksh }}</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="summary-card warning">
            <div class="card-icon">📋</div>
            <div class="card-label">Unpaid Contributions <span class="text-muted-sm">(charges owed)</span></div>
            <div class="card-value">{{ summary()!.unpaidCount }}</div>
            @if (summary()!.unpaidWithPendingPaymentCount > 0) {
              <div class="card-sub">{{ summary()!.unpaidWithPendingPaymentCount }} already have a payment in progress</div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Charts Row -->
    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="panel h-100">
          <div class="panel-header">
            <span>🍩</span><h5>Outstanding by Category</h5>
          </div>
          <div class="panel-body">
            @if (!chartsLoading() && !outstandingForCharts().length) {
              <div class="text-center py-4 text-muted">
                <div style="font-size:2rem">📭</div>
                <p class="mb-0">No outstanding contributions</p>
              </div>
            } @else {
              <div class="chart-wrapper">
                <canvas #catChart></canvas>
              </div>
            }
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="panel h-100">
          <div class="panel-header">
            <span>📊</span><h5>Outstanding by Period</h5>
          </div>
          <div class="panel-body">
            @if (!chartsLoading() && !outstandingForCharts().length) {
              <div class="text-center py-4 text-muted">
                <div style="font-size:2rem">📭</div>
                <p class="mb-0">No outstanding contributions</p>
              </div>
            } @else {
              <div class="chart-wrapper">
                <canvas #periodChart></canvas>
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Contributions Table -->
    <div class="panel">
      <div class="panel-header">
        <span>📋</span>
        <h5>Contributions</h5>
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-sm btn-outline-success" (click)="exportCsv()">📥 CSV</button>
          <button class="btn btn-sm btn-outline-danger" (click)="exportPdf()">📄 PDF</button>
        </div>
      </div>
      <div class="panel-body">
        <form [formGroup]="contributionFilterForm" class="row g-2 align-items-end mb-3">
          <div class="col-sm-4 col-md-3">
            <label class="form-label">Status</label>
            <select class="form-select" formControlName="settled">
              <option value="">All</option>
              <option value="false">Unpaid</option>
              <option value="true">Paid</option>
            </select>
          </div>
          <div class="col-sm-4 col-md-3">
            <label class="form-label">Due From</label>
            <input type="date" class="form-control" formControlName="from">
          </div>
          <div class="col-sm-4 col-md-3">
            <label class="form-label">Due To</label>
            <input type="date" class="form-control" formControlName="to">
          </div>
          <div class="col-md-3">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="clearContributionFilters()">Clear</button>
          </div>
        </form>

        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!contributions().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">📭</div>
            <p>No contributions match your filters</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Category</th>
                  <th>Period</th>
                  <th>Amount Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (c of contributions(); track c.id) {
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <div class="avatar sm bg-accent">{{ initials(c.user.fullName) }}</div>
                        <div>
                          <div class="fw-semibold">{{ c.user.fullName }}</div>
                          <div class="text-muted-sm">{{ c.user.houseNumber }}</div>
                        </div>
                      </div>
                    </td>
                    <td>{{ c.contributionType.name }}</td>
                    <td><span class="font-mono">{{ c.period }}</span></td>
                    <td>{{ c.amount | ksh }}</td>
                    <td class="text-success">{{ c.paidAmount | ksh }}</td>
                    <td class="text-danger fw-semibold">{{ c.balance | ksh }}</td>
                    <td>
                      @if (c.settled) {
                        <span class="badge-settled">Paid</span>
                      } @else if (c.paidAmount > 0) {
                        <span class="badge-partial">Partial</span>
                      } @else {
                        <span class="badge-unpaid">Unpaid</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="table-light fw-bold">
                  <td colspan="4" class="text-end">Totals:</td>
                  <td class="text-success">{{ totalPaidAmount() | ksh }}</td>
                  <td class="text-danger">{{ totalOutstanding() | ksh }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Payment Activity -->
    <div class="panel mt-4">
      <div class="panel-header">
        <span>💳</span>
        <h5>Payment Activity</h5>
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-sm btn-outline-success" (click)="exportPaymentsCsv()">📥 CSV</button>
          <button class="btn btn-sm btn-outline-danger" (click)="exportPaymentsPdf()">📄 PDF</button>
        </div>
      </div>
      <div class="panel-body">
        <form [formGroup]="paymentFilterForm" class="row g-2 align-items-end mb-3">
          <div class="col-sm-4 col-md-3">
            <label class="form-label">Status</label>
            <select class="form-select" formControlName="status">
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="TIMEOUT">Timed Out</option>
            </select>
          </div>
          <div class="col-sm-4 col-md-3">
            <label class="form-label">From</label>
            <input type="date" class="form-control" formControlName="from">
          </div>
          <div class="col-sm-4 col-md-3">
            <label class="form-label">To</label>
            <input type="date" class="form-control" formControlName="to">
          </div>
          <div class="col-md-3">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="clearPaymentFilters()">Clear</button>
          </div>
        </form>

        <!-- Totals cards -->
        <p class="text-muted-sm mb-2">
          Counts below are individual M-Pesa payment attempts, not contributions — a single
          unpaid contribution may have zero, one, or several attempts against it.
        </p>
        @if (paymentTotals()) {
          <div class="row g-2 mb-3">
            @for (s of paymentStatuses; track s) {
              <div class="col-sm-6 col-md-3">
                <div class="text-center p-2 bg-light rounded">
                  <div class="text-muted-sm">{{ s }}</div>
                  <div class="fw-bold">{{ paymentTotals()![s].count }}</div>
                  <div class="text-muted-sm">{{ paymentTotals()![s].total | ksh }}</div>
                </div>
              </div>
            }
          </div>
        }

        @if (paymentsLoading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!payments().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">📭</div>
            <p>No payment activity matches your filters</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                @for (p of payments(); track p.id) {
                  <tr>
                    <td>{{ p.user?.fullName ?? '—' }}</td>
                    <td class="fw-semibold">{{ p.amount | ksh }}</td>
                    <td>{{ p.method }}</td>
                    <td class="font-mono">{{ p.transactionReference ?? '—' }}</td>
                    <td>
                      <span class="badge"
                        [class.bg-success]="p.status==='COMPLETED'"
                        [class.bg-warning]="p.status==='PENDING'"
                        [class.text-dark]="p.status==='PENDING'"
                        [class.bg-danger]="p.status==='FAILED'"
                        [class.bg-secondary]="p.status==='CANCELLED' || p.status==='TIMEOUT'">
                        {{ p.status }}
                      </span>
                    </td>
                    <td class="text-muted-sm">{{ p.createdAt | date:'medium' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <span class="text-muted-sm">Page {{ paymentPage() + 1 }} of {{ paymentTotalPages() || 1 }}</span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" [disabled]="paymentPage()===0"
                (click)="changePaymentPage(paymentPage()-1)">‹ Prev</button>
              <button class="btn btn-sm btn-outline-secondary" [disabled]="paymentPage()+1>=paymentTotalPages()"
                (click)="changePaymentPage(paymentPage()+1)">Next ›</button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class AdminReportsComponent implements OnInit {
  @ViewChild('catChart') catRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('periodChart') periodRef!: ElementRef<HTMLCanvasElement>;

  private injector = inject(Injector);

  summary = signal<EstateSummary | null>(null);

  /** Table data — respects the Paid/Unpaid/All + date-range filter. */
  contributions = signal<Contribution[]>([]);
  loading = signal(true);
  contributionFilterForm: FormGroup;

  /** Chart data — always the current unpaid breakdown, independent of the table filter above,
   *  since the charts are specifically an "outstanding" view. */
  outstandingForCharts = signal<Contribution[]>([]);
  chartsLoading = signal(true);

  payments = signal<Payment[]>([]);
  paymentTotals = signal<PaymentTotals | null>(null);
  paymentsLoading = signal(false);
  paymentPage = signal(0);
  paymentTotalPages = signal(0);
  paymentFilterForm: FormGroup;
  paymentStatuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'];

  totalPaidAmount = () => this.contributions().reduce((s, c) => s + c.paidAmount, 0);
  totalOutstanding = () => this.contributions().reduce((s, c) => s + c.balance, 0);

  private catChart?: Chart;
  private periodChart?: Chart;

  constructor(private fb: FormBuilder, private reportSvc: ReportService, private toast: ToastService) {
    this.contributionFilterForm = this.fb.group({ settled: '', from: '', to: '' });
    this.contributionFilterForm.valueChanges.subscribe(() => this.loadContributions());

    this.paymentFilterForm = this.fb.group({ status: '', from: '', to: '' });
    this.paymentFilterForm.valueChanges.subscribe(() => this.loadPayments(0));
  }

  ngOnInit() {
    this.reportSvc.getSummary().subscribe({ next: s => this.summary.set(s) });
    this.loadContributions();

    this.reportSvc.getContributions({ settled: false }).subscribe({
      next: data => {
        this.outstandingForCharts.set(data);
        this.chartsLoading.set(false);
        this.scheduleChartBuild();
      },
      error: () => { this.chartsLoading.set(false); }
    });

    this.loadPayments(0);
  }

  loadContributions() {
    const { settled, from, to } = this.contributionFilterForm.value;
    this.loading.set(true);
    this.reportSvc.getContributions({
      settled: settled === '' ? undefined : settled === 'true',
      from: from || undefined,
      to: to || undefined
    }).subscribe({
      next: data => { this.contributions.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load contributions'); }
    });
  }

  clearContributionFilters() {
    this.contributionFilterForm.reset({ settled: '', from: '', to: '' });
  }

  loadPayments(page: number) {
    const { status, from, to } = this.paymentFilterForm.value;
    this.paymentsLoading.set(true);
    this.paymentPage.set(page);
    this.reportSvc.getPayments({ status, from, to, page, size: 20 }).subscribe({
      next: res => {
        this.payments.set(res.content);
        this.paymentTotalPages.set(res.totalPages);
        this.paymentsLoading.set(false);
      },
      error: () => { this.paymentsLoading.set(false); this.toast.error('Failed to load payment activity'); }
    });
    this.reportSvc.getPaymentTotals({ from, to }).subscribe({
      next: t => this.paymentTotals.set(t),
      error: () => {}
    });
  }

  changePaymentPage(page: number) {
    if (page < 0 || page >= this.paymentTotalPages()) return;
    this.loadPayments(page);
  }

  clearPaymentFilters() {
    this.paymentFilterForm.reset({ status: '', from: '', to: '' });
  }

  exportPaymentsCsv() {
    const rows = [['Member', 'Amount', 'Method', 'Reference', 'Status', 'Date']];
    this.payments().forEach(p => rows.push([
      p.user?.fullName ?? '', p.amount.toString(), p.method,
      p.transactionReference ?? '', p.status, p.createdAt ?? ''
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'payment-activity.csv'; a.click();
    URL.revokeObjectURL(url);
    this.toast.success('CSV exported!');
  }

  exportPaymentsPdf() {
    const doc = new jsPDF();
    doc.setFillColor(26, 82, 118);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Payment Activity Report', 14, 20);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 30);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 45,
      head: [['Member', 'Amount', 'Method', 'Reference', 'Status', 'Date']],
      body: this.payments().map(p => [
        p.user?.fullName ?? '',
        `KSh ${p.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
        p.method,
        p.transactionReference ?? '—',
        p.status,
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-KE') : ''
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [26, 82, 118] },
      alternateRowStyles: { fillColor: [245, 250, 255] }
    });
    doc.save('payment-activity.pdf');
    this.toast.success('PDF exported! (current page only)');
  }

  /** Deferred until after Angular renders the "data loaded" branch (see dashboard.ts for the
   *  same fix) — otherwise catRef/periodRef are still undefined when this runs. */
  private scheduleChartBuild() {
    if (!this.outstandingForCharts().length) return;
    afterNextRender(() => this.buildCharts(), { injector: this.injector });
  }

  buildCharts() {
    this.buildCatChart();
    this.buildPeriodChart();
  }

  buildCatChart() {
    if (!this.catRef) return;
    const byCat: Record<string, number> = {};
    this.outstandingForCharts().forEach(c => {
      const n = c.contributionType.name;
      byCat[n] = (byCat[n] ?? 0) + c.balance;
    });
    if (this.catChart) this.catChart.destroy();
    this.catChart = new Chart(this.catRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: Object.keys(byCat),
        datasets: [{ data: Object.values(byCat), backgroundColor: ['#c0392b','#e67e22','#2e86c1','#8e44ad','#1e8449'], borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  buildPeriodChart() {
    if (!this.periodRef) return;
    const byPeriod: Record<string, number> = {};
    this.outstandingForCharts().forEach(c => {
      byPeriod[c.period] = (byPeriod[c.period] ?? 0) + c.balance;
    });
    const sorted = Object.entries(byPeriod).sort(([a],[b]) => periodSortKey(a) - periodSortKey(b));
    if (this.periodChart) this.periodChart.destroy();
    this.periodChart = new Chart(this.periodRef.nativeElement, {
      type: 'bar',
      data: {
        labels: sorted.map(([k])=>k),
        datasets: [{ label: 'Outstanding (KSh)', data: sorted.map(([,v])=>v), backgroundColor: 'rgba(192,57,43,0.7)', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  private contributionStatusLabel(c: Contribution): string {
    if (c.settled) return 'Paid';
    return c.paidAmount > 0 ? 'Partial' : 'Unpaid';
  }

  exportCsv() {
    const rows = [['Resident','House','Category','Period','Amount Due','Paid','Balance','Status']];
    this.contributions().forEach(c => rows.push([
      c.user.fullName, c.user.houseNumber??'', c.contributionType.name,
      c.period, c.amount.toString(), c.paidAmount.toString(), c.balance.toString(),
      this.contributionStatusLabel(c)
    ]));
    const csv = rows.map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'contributions-report.csv'; a.click();
    this.toast.success('CSV exported!');
  }

  exportPdf() {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(26,82,118); doc.rect(0,0,297,30,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16);
    doc.text('Estate Contributions Report', 14, 18);
    doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, 220, 18);
    doc.setTextColor(0,0,0);

    const s = this.summary();
    if (s) {
      doc.setFontSize(10);
      doc.text(`Total Collected: KSh ${s.totalCollected.toLocaleString()}   |   Total Outstanding: KSh ${s.totalOutstanding.toLocaleString()}   |   Unpaid Count: ${s.unpaidCount}`, 14, 40);
    }

    autoTable(doc, {
      startY: 47,
      head: [['Resident','House','Category','Period','Amount Due','Paid','Balance','Status']],
      body: this.contributions().map(c => [
        c.user.fullName, c.user.houseNumber??'', c.contributionType.name, c.period,
        `KSh ${c.amount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.paidAmount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.balance.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        this.contributionStatusLabel(c)
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26,82,118] },
      alternateRowStyles: { fillColor: [245,250,255] }
    });
    doc.save('contributions-report.pdf');
    this.toast.success('PDF exported!');
  }

  initials(name: string) {
    return name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  }
}
