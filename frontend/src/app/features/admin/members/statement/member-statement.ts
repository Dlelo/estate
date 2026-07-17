import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportService } from '../../../../core/services/report.service';
import { UserService } from '../../../../core/services/user.service';
import { ToastService } from '../../../../core/services/toast.service';
import { KshCurrencyPipe } from '../../../../shared/pipes/ksh-currency.pipe';
import { StatementEntry, User } from '../../../../core/models';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-member-statement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, KshCurrencyPipe],
  template: `
    <div class="d-flex align-items-center gap-2 mb-3 no-print">
      <a routerLink="/admin/users" class="btn btn-sm btn-outline-secondary">← Back to Members</a>
    </div>

    <div class="panel">
      <div class="panel-header">
        <span>🧾</span>
        <h5>Contribution Statement @if (member()) { — {{ member()!.fullName }} }</h5>
        <div class="ms-auto d-flex gap-2 no-print">
          <button class="btn btn-sm btn-outline-secondary" (click)="print()">🖨️ Print</button>
        </div>
      </div>
      <div class="panel-body">
        @if (member()) {
          <div class="row g-2 mb-3 text-muted-sm">
            <div class="col-auto"><strong>House:</strong> {{ member()!.houseNumber ?? '—' }}</div>
            <div class="col-auto"><strong>Phone:</strong> {{ member()!.phoneNumber }}</div>
            @if (member()!.email) { <div class="col-auto"><strong>Email:</strong> {{ member()!.email }} </div> }
          </div>
        }

        <form [formGroup]="filterForm" class="row g-2 align-items-end mb-3 no-print">
          <div class="col-sm-6 col-md-3">
            <label class="form-label">Search</label>
            <input type="text" class="form-control" formControlName="search" placeholder="Description, reference, notes...">
          </div>
          <div class="col-sm-3 col-md-3">
            <label class="form-label">From</label>
            <input type="date" class="form-control" formControlName="from">
          </div>
          <div class="col-sm-3 col-md-3">
            <label class="form-label">To</label>
            <input type="date" class="form-control" formControlName="to">
          </div>
          <div class="col-md-3">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="clearFilters()">Clear</button>
          </div>
        </form>

        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        } @else if (!filteredEntries().length) {
          <div class="text-center py-5 text-muted">
            <div style="font-size:3rem">📭</div>
            <p>No statement entries match your filters</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                @for (e of pagedEntries(); track $index) {
                  <tr>
                    <td class="text-muted-sm">{{ e.date | date:'medium' }}</td>
                    <td>
                      <span class="badge" [class.bg-primary]="e.type==='CHARGE'" [class.bg-success]="e.type==='PAYMENT'">
                        {{ e.type }}
                      </span>
                    </td>
                    <td>{{ e.description }}</td>
                    <td class="text-muted-sm">{{ e.dueDate ?? '—' }}</td>
                    <td [class.text-danger]="e.debit > 0">{{ e.debit > 0 ? (e.debit | ksh) : '—' }}</td>
                    <td [class.text-success]="e.credit > 0">{{ e.credit > 0 ? (e.credit | ksh) : '—' }}</td>
                    <td class="fw-semibold">{{ e.runningBalance | ksh }}</td>
                    <td>{{ e.method ?? '—' }}</td>
                    <td class="font-mono">{{ e.transactionReference ?? '—' }}</td>
                    <td>{{ e.status ?? '—' }}</td>
                    <td class="text-muted-sm">{{ e.notes ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="d-flex justify-content-between align-items-center mt-3 no-print">
            <span class="text-muted-sm">Page {{ page() + 1 }} of {{ totalPages() }} ({{ filteredEntries().length }} entries)</span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" [disabled]="page()===0"
                (click)="changePage(page()-1)">‹ Prev</button>
              <button class="btn btn-sm btn-outline-secondary" [disabled]="page()+1>=totalPages()"
                (click)="changePage(page()+1)">Next ›</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @media print {
      .no-print { display: none !important; }
    }
  `]
})
export class MemberStatementComponent implements OnInit {
  member = signal<User | null>(null);
  entries = signal<StatementEntry[]>([]);
  loading = signal(true);
  page = signal(0);
  filterForm: FormGroup;

  private userId!: number;

  filteredEntries = computed(() => {
    const term = (this.filterForm?.value.search ?? '').toLowerCase().trim();
    if (!term) return this.entries();
    return this.entries().filter(e =>
      e.description.toLowerCase().includes(term) ||
      (e.transactionReference ?? '').toLowerCase().includes(term) ||
      (e.notes ?? '').toLowerCase().includes(term)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredEntries().length / PAGE_SIZE)));

  pagedEntries = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.filteredEntries().slice(start, start + PAGE_SIZE);
  });

  constructor(
    private route: ActivatedRoute,
    private reportSvc: ReportService,
    private userSvc: UserService,
    private toast: ToastService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({ search: '', from: '', to: '' });
  }

  ngOnInit() {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    this.userSvc.getById(this.userId).subscribe({
      next: u => this.member.set(u),
      error: () => this.toast.error('Failed to load member details')
    });

    this.filterForm.get('search')!.valueChanges.subscribe(() => this.page.set(0));
    this.filterForm.get('from')!.valueChanges.subscribe(() => this.load());
    this.filterForm.get('to')!.valueChanges.subscribe(() => this.load());

    this.load();
  }

  load() {
    const { from, to } = this.filterForm.value;
    this.loading.set(true);
    this.page.set(0);
    this.reportSvc.getMemberStatement(this.userId, from || undefined, to || undefined).subscribe({
      next: data => { this.entries.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load statement'); }
    });
  }

  clearFilters() {
    this.filterForm.reset({ search: '', from: '', to: '' });
  }

  changePage(page: number) {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
  }

  print() {
    window.print();
  }
}
