import { Component, OnInit, signal, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../core/services/toast.service';
import { KshCurrencyPipe } from '../../../shared/pipes/ksh-currency.pipe';
import { Contribution, EstateSummary } from '../../../core/models';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, KshCurrencyPipe],
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
            <div class="card-label">Unpaid Contributions</div>
            <div class="card-value">{{ summary()!.unpaidCount }}</div>
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
            <div class="chart-wrapper">
              <canvas #catChart></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="panel h-100">
          <div class="panel-header">
            <span>📊</span><h5>Outstanding by Period</h5>
          </div>
          <div class="panel-body">
            <div class="chart-wrapper">
              <canvas #periodChart></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unsettled Table -->
    <div class="panel">
      <div class="panel-header">
        <span>📋</span>
        <h5>Unsettled Contributions</h5>
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-sm btn-outline-success" (click)="exportCsv()">📥 CSV</button>
          <button class="btn btn-sm btn-outline-danger" (click)="exportPdf()">📄 PDF</button>
        </div>
      </div>
      <div class="panel-body p-0">
        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!unsettled().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">🎉</div>
            <p>All contributions are settled!</p>
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
                @for (c of unsettled(); track c.id) {
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
                      @if (c.paidAmount > 0) {
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
                  <td colspan="5" class="text-end">Total Outstanding:</td>
                  <td class="text-danger">{{ totalOutstanding() | ksh }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class AdminReportsComponent implements OnInit, AfterViewInit {
  @ViewChild('catChart') catRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('periodChart') periodRef!: ElementRef<HTMLCanvasElement>;

  summary = signal<EstateSummary | null>(null);
  unsettled = signal<Contribution[]>([]);
  loading = signal(true);

  totalOutstanding = () => this.unsettled().reduce((s, c) => s + c.balance, 0);

  private catChart?: Chart;
  private periodChart?: Chart;
  private viewReady = false;

  constructor(private reportSvc: ReportService, private toast: ToastService) {}

  ngOnInit() {
    this.reportSvc.getSummary().subscribe({ next: s => this.summary.set(s) });
    this.reportSvc.getUnsettled().subscribe({
      next: data => {
        this.unsettled.set(data);
        this.loading.set(false);
        if (this.viewReady) this.buildCharts();
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load report data'); }
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    if (!this.loading()) this.buildCharts();
  }

  buildCharts() {
    this.buildCatChart();
    this.buildPeriodChart();
  }

  buildCatChart() {
    if (!this.catRef) return;
    const byCat: Record<string, number> = {};
    this.unsettled().forEach(c => {
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
    this.unsettled().forEach(c => {
      byPeriod[c.period] = (byPeriod[c.period] ?? 0) + c.balance;
    });
    const sorted = Object.entries(byPeriod).sort(([a],[b]) => a.localeCompare(b));
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

  exportCsv() {
    const rows = [['Resident','House','Category','Period','Amount Due','Paid','Balance','Status']];
    this.unsettled().forEach(c => rows.push([
      c.user.fullName, c.user.houseNumber??'', c.contributionType.name,
      c.period, c.amount.toString(), c.paidAmount.toString(), c.balance.toString(),
      c.paidAmount > 0 ? 'Partial' : 'Unpaid'
    ]));
    const csv = rows.map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'unsettled-report.csv'; a.click();
    this.toast.success('CSV exported!');
  }

  exportPdf() {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(26,82,118); doc.rect(0,0,297,30,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16);
    doc.text('Estate Unsettled Contributions Report', 14, 18);
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
      body: this.unsettled().map(c => [
        c.user.fullName, c.user.houseNumber??'', c.contributionType.name, c.period,
        `KSh ${c.amount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.paidAmount.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        `KSh ${c.balance.toLocaleString('en-KE',{minimumFractionDigits:2})}`,
        c.paidAmount > 0 ? 'Partial' : 'Unpaid'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26,82,118] },
      alternateRowStyles: { fillColor: [245,250,255] }
    });
    doc.save('unsettled-report.pdf');
    this.toast.success('PDF exported!');
  }

  initials(name: string) {
    return name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  }
}
