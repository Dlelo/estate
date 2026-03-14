import { Component, OnInit, signal, computed, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContributionService } from '../../core/services/contribution.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { KshCurrencyPipe } from '../../shared/pipes/ksh-currency.pipe';
import { Contribution, EstateSummary } from '../../core/models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, KshCurrencyPipe],
  template: `
    <!-- Summary Cards -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="summary-card primary">
          <div class="card-icon">💰</div>
          <div class="card-label">Total Paid</div>
          <div class="card-value">{{ totalPaid() | ksh }}</div>
          <div class="card-sub">All contributions made</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="summary-card danger">
          <div class="card-icon">⚠️</div>
          <div class="card-label">Outstanding Balance</div>
          <div class="card-value">{{ totalBalance() | ksh }}</div>
          <div class="card-sub">{{ unpaidCount() }} unpaid contribution(s)</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="summary-card success">
          <div class="card-icon">✅</div>
          <div class="card-label">Settled</div>
          <div class="card-value">{{ settledCount() }}</div>
          <div class="card-sub">Fully paid contributions</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="summary-card warning">
          <div class="card-icon">📅</div>
          <div class="card-label">This Month</div>
          <div class="card-value">{{ thisMonthPaid() | ksh }}</div>
          <div class="card-sub">{{ currentPeriod() }}</div>
        </div>
      </div>
    </div>

    @if (auth.isAdmin() && estateSummary()) {
      <div class="row g-3 mb-4">
        <div class="col-12">
          <div class="panel">
            <div class="panel-header">
              <span>📊</span><h5>Estate Overview (Admin)</h5>
            </div>
            <div class="panel-body">
              <div class="row g-3">
                <div class="col-md-4">
                  <div class="text-center p-3 bg-light rounded">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--success)">
                      {{ estateSummary()!.totalCollected | ksh }}
                    </div>
                    <div class="text-muted-sm">Total Collected</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="text-center p-3 bg-light rounded">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--danger)">
                      {{ estateSummary()!.totalOutstanding | ksh }}
                    </div>
                    <div class="text-muted-sm">Total Outstanding</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="text-center p-3 bg-light rounded">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--accent)">
                      {{ estateSummary()!.unpaidCount }}
                    </div>
                    <div class="text-muted-sm">Unpaid Contributions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <div class="row g-3 mb-4">
      <!-- Contributions by Category -->
      <div class="col-md-6">
        <div class="panel h-100">
          <div class="panel-header">
            <span>🍩</span><h5>By Category</h5>
          </div>
          <div class="panel-body">
            @if (loading()) {
              <div class="text-center py-4">
                <div class="spinner-border text-primary" style="width:2rem;height:2rem"></div>
              </div>
            } @else {
              <div class="chart-wrapper">
                <canvas #doughnut></canvas>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Monthly trend -->
      <div class="col-md-6">
        <div class="panel h-100">
          <div class="panel-header">
            <span>📈</span><h5>Monthly Payments</h5>
          </div>
          <div class="panel-body">
            @if (loading()) {
              <div class="text-center py-4">
                <div class="spinner-border text-primary" style="width:2rem;height:2rem"></div>
              </div>
            } @else {
              <div class="chart-wrapper">
                <canvas #bar></canvas>
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Contributions -->
    <div class="panel">
      <div class="panel-header">
        <span>💳</span><h5>Recent Contributions</h5>
        <a routerLink="/contributions" class="btn btn-sm btn-outline-primary ms-auto">View All</a>
      </div>
      <div class="panel-body p-0">
        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!contributions().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">📭</div>
            <p>No contributions found</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Period</th>
                  <th>Amount Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (c of recentContributions(); track c.id) {
                  <tr>
                    <td><span class="fw-semibold">{{ c.contributionType.name }}</span></td>
                    <td>{{ c.period }}</td>
                    <td>{{ c.amount | ksh }}</td>
                    <td class="text-success">{{ c.paidAmount | ksh }}</td>
                    <td [class.text-danger]="c.balance > 0">{{ c.balance | ksh }}</td>
                    <td>
                      @if (c.settled) {
                        <span class="badge-settled">Settled</span>
                      } @else if (c.paidAmount > 0) {
                        <span class="badge-partial">Partial</span>
                      } @else {
                        <span class="badge-unpaid">Unpaid</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('doughnut') doughnutRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bar') barRef!: ElementRef<HTMLCanvasElement>;

  contributions = signal<Contribution[]>([]);
  estateSummary = signal<EstateSummary | null>(null);
  loading = signal(true);

  totalPaid    = computed(() => this.contributions().reduce((s, c) => s + c.paidAmount, 0));
  totalBalance = computed(() => this.contributions().reduce((s, c) => s + c.balance, 0));
  settledCount = computed(() => this.contributions().filter(c => c.settled).length);
  unpaidCount  = computed(() => this.contributions().filter(c => !c.settled).length);
  recentContributions = computed(() => [...this.contributions()].slice(0, 8));

  currentPeriod = computed(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  thisMonthPaid = computed(() => {
    const p = this.currentPeriod();
    return this.contributions().filter(c => c.period === p).reduce((s, c) => s + c.paidAmount, 0);
  });

  private doughnutChart?: Chart;
  private barChart?: Chart;
  private chartsReady = false;

  constructor(
    public auth: AuthService,
    private contribSvc: ContributionService,
    private reportSvc: ReportService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.load();
  }

  ngAfterViewInit() {
    this.chartsReady = true;
    if (!this.loading()) this.buildCharts();
  }

  load() {
    this.loading.set(true);
    const userId = this.auth.getUserIdFromToken();

    // Use a fallback: try to get contributions for user 1 if no userId in token
    const uid = userId ?? 1;
    this.contribSvc.getByUser(uid).subscribe({
      next: data => {
        this.contributions.set(data);
        this.loading.set(false);
        if (this.chartsReady) this.buildCharts();
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load contributions');
      }
    });

    if (this.auth.isAdmin()) {
      this.reportSvc.getSummary().subscribe({
        next: s => this.estateSummary.set(s),
        error: () => {}
      });
    }
  }

  buildCharts() {
    this.buildDoughnut();
    this.buildBar();
  }

  buildDoughnut() {
    if (!this.doughnutRef) return;
    const byCategory: Record<string, number> = {};
    this.contributions().forEach(c => {
      const name = c.contributionType.name;
      byCategory[name] = (byCategory[name] ?? 0) + c.paidAmount;
    });
    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    if (this.doughnutChart) this.doughnutChart.destroy();
    this.doughnutChart = new Chart(this.doughnutRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: ['#2e86c1','#e67e22','#1e8449','#8e44ad','#c0392b'], borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  buildBar() {
    if (!this.barRef) return;
    const byPeriod: Record<string, number> = {};
    this.contributions().forEach(c => {
      byPeriod[c.period] = (byPeriod[c.period] ?? 0) + c.paidAmount;
    });
    const sorted = Object.entries(byPeriod).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    if (this.barChart) this.barChart.destroy();
    this.barChart = new Chart(this.barRef.nativeElement, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{
          label: 'Paid (KSh)',
          data: sorted.map(([,v]) => v),
          backgroundColor: 'rgba(46,134,193,0.7)',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}
