import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ContributionTypeService, ContributionTypeRequest } from '../../../core/services/contribution-type.service';
import { ContributionService } from '../../../core/services/contribution.service';
import { ToastService } from '../../../core/services/toast.service';
import { KshCurrencyPipe } from '../../../shared/pipes/ksh-currency.pipe';
import { ContributionType } from '../../../core/models';

@Component({
  selector: 'app-admin-contribution-types',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, KshCurrencyPipe],
  template: `
    <div class="row g-4">

      <!-- Left: Type List -->
      <div class="col-lg-7">
        <div class="panel">
          <div class="panel-header">
            <span>📋</span>
            <h5>Contribution Categories</h5>
            <span class="ms-auto badge bg-secondary">{{ types().length }}</span>
          </div>
          <div class="panel-body p-0">
            @if (loading()) {
              <div class="text-center py-5">
                <div class="spinner-border text-primary"></div>
              </div>
            } @else if (!types().length) {
              <div class="text-center py-5 text-muted">
                <div style="font-size:3rem">📂</div>
                <p>No contribution types yet. Create one →</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table class="table table-modern mb-0">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Frequency</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of types(); track t.id) {
                      <tr [class.opacity-50]="!t.active">
                        <td>
                          <div class="d-flex align-items-center gap-2">
                            <span style="font-size:1.3rem">{{ typeIcon(t.name) }}</span>
                            <div>
                              <div class="fw-semibold">{{ t.name }}</div>
                              <div class="text-muted-sm">ID: {{ t.id }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="fw-semibold">{{ t.amount | ksh }}</td>
                        <td>
                          <span class="badge"
                            [class.bg-primary]="t.frequency==='MONTHLY'"
                            [class.bg-warning]="t.frequency==='ANNUAL'"
                            [class.text-dark]="t.frequency==='ANNUAL'"
                            [class.bg-info]="t.frequency==='ONE_TIME'"
                            [class.text-dark]="t.frequency==='ONE_TIME'">
                            {{ freqLabel(t.frequency) }}
                          </span>
                        </td>
                        <td>
                          <div class="form-check form-switch mb-0">
                            <input type="checkbox" class="form-check-input" role="switch"
                              [checked]="t.active" (change)="toggleActive(t)"
                              style="cursor:pointer">
                          </div>
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <button class="btn btn-icon btn-outline-primary" title="Edit"
                              (click)="openEdit(t)">✏️</button>
                            <button class="btn btn-icon btn-outline-danger" title="Delete"
                              (click)="confirmDelete(t)">🗑️</button>
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

        <!-- Generate Contributions Panel -->
        <div class="panel mt-4">
          <div class="panel-header">
            <span>⚙️</span>
            <h5>Generate Contributions</h5>
          </div>
          <div class="panel-body">
            <p class="text-muted-sm mb-3">
              Manually generate contribution records for all active residents for a specific period.
              Monthly types generate every period; annual types only generate in January periods.
            </p>
            <div class="d-flex gap-2 align-items-end">
              <div class="flex-grow-1">
                <label class="form-label">Period (YYYY-MM)</label>
                <input type="month" class="form-control" [(ngModel)]="generatePeriod"
                  [ngModelOptions]="{standalone:true}">
              </div>
              <button class="btn btn-primary" (click)="generate()" [disabled]="!generatePeriod || generateLoading()">
                @if (generateLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Create / Edit Form -->
      <div class="col-lg-5">
        <div class="panel">
          <div class="panel-header">
            <span>{{ editing() ? '✏️' : '➕' }}</span>
            <h5>{{ editing() ? 'Edit Category' : 'New Category' }}</h5>
            @if (editing()) {
              <button class="btn btn-sm btn-outline-secondary ms-auto" (click)="cancelEdit()">Cancel</button>
            }
          </div>
          <div class="panel-body">
            <form [formGroup]="typeForm" (ngSubmit)="save()">

              <div class="mb-3">
                <label class="form-label">Category Name</label>
                <input type="text" class="form-control" formControlName="name"
                  placeholder="e.g. Garbage Collection"
                  [class.is-invalid]="touched('name')">
                @if (touched('name')) {
                  <div class="invalid-feedback">Name is required</div>
                }
              </div>

              <div class="mb-3">
                <label class="form-label">Amount (KSh)</label>
                <div class="input-group">
                  <span class="input-group-text">KSh</span>
                  <input type="number" class="form-control" formControlName="amount"
                    placeholder="500" min="1"
                    [class.is-invalid]="touched('amount')">
                </div>
                @if (touched('amount')) {
                  <div class="invalid-feedback d-block">Amount must be greater than 0</div>
                }
              </div>

              <div class="mb-4">
                <label class="form-label">Billing Frequency</label>
                <div class="row g-2">
                  <div class="col-4">
                    <input type="radio" class="btn-check" id="freq-monthly" formControlName="frequency" value="MONTHLY">
                    <label class="btn btn-outline-primary w-100" for="freq-monthly">
                      📅 Monthly
                    </label>
                  </div>
                  <div class="col-4">
                    <input type="radio" class="btn-check" id="freq-annual" formControlName="frequency" value="ANNUAL">
                    <label class="btn btn-outline-warning w-100" for="freq-annual">
                      📆 Annual
                    </label>
                  </div>
                  <div class="col-4">
                    <input type="radio" class="btn-check" id="freq-once" formControlName="frequency" value="ONE_TIME">
                    <label class="btn btn-outline-info w-100" for="freq-once">
                      1️⃣ Once
                    </label>
                  </div>
                </div>
                @if (touched('frequency')) {
                  <div class="text-danger mt-1" style="font-size:.8rem">Please select a frequency</div>
                }
              </div>

              <!-- Preview -->
              @if (typeForm.value.name && typeForm.value.amount) {
                <div class="alert alert-info py-2 mb-3" style="font-size:.85rem">
                  <strong>Preview:</strong> Each active resident will be charged
                  <strong>KSh {{ typeForm.value.amount | number }}</strong> for
                  <strong>{{ typeForm.value.name }}</strong>
                  {{ typeForm.value.frequency === 'MONTHLY' ? 'every month' :
                     typeForm.value.frequency === 'ANNUAL' ? 'every year' : 'once' }}.
                </div>
              }

              @if (formError()) {
                <div class="alert alert-danger py-2 mb-3">{{ formError() }}</div>
              }

              <button type="submit" class="btn btn-primary w-100" [disabled]="saveLoading()">
                @if (saveLoading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
                {{ editing() ? 'Save Changes' : 'Create Category' }}
              </button>
            </form>
          </div>
        </div>

        <!-- Quick Reference -->
        <div class="panel mt-4">
          <div class="panel-header"><span>💡</span><h5>Category Suggestions</h5></div>
          <div class="panel-body">
            <div class="d-flex flex-wrap gap-2">
              @for (s of suggestions; track s.name) {
                <button class="btn btn-sm btn-outline-secondary" (click)="fillSuggestion(s)">
                  {{ s.icon }} {{ s.name }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminContributionTypesComponent implements OnInit {
  types = signal<ContributionType[]>([]);
  loading = signal(true);
  editing = signal<ContributionType | null>(null);
  saveLoading = signal(false);
  formError = signal('');
  generatePeriod = '';
  generateLoading = signal(false);

  typeForm: FormGroup;

  suggestions = [
    { name: 'Garbage Collection', amount: 500,  frequency: 'MONTHLY' as const, icon: '🗑️' },
    { name: 'Security Officers',  amount: 2000, frequency: 'MONTHLY' as const, icon: '🔐' },
    { name: 'Fencing',            amount: 5000, frequency: 'ANNUAL'  as const, icon: '🚧' },
    { name: 'Road Upgrades',      amount: 3000, frequency: 'ANNUAL'  as const, icon: '🛣️' },
    { name: 'Street Lighting',    amount: 800,  frequency: 'MONTHLY' as const, icon: '💡' },
    { name: 'Water Borehole',     amount: 1500, frequency: 'MONTHLY' as const, icon: '💧' },
  ];

  constructor(
    private fb: FormBuilder,
    private typeSvc: ContributionTypeService,
    private contribSvc: ContributionService,
    private toast: ToastService
  ) {
    this.typeForm = this.fb.group({
      name: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      frequency: ['MONTHLY', Validators.required]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.typeSvc.getAll().subscribe({
      next: t => { this.types.set(t); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load categories'); }
    });
  }

  touched(f: string) { const c = this.typeForm.get(f); return c?.invalid && c?.touched; }

  openEdit(t: ContributionType) {
    this.editing.set(t);
    this.typeForm.patchValue({ name: t.name, amount: t.amount, frequency: t.frequency });
    this.formError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editing.set(null);
    this.typeForm.reset({ frequency: 'MONTHLY' });
    this.formError.set('');
  }

  fillSuggestion(s: typeof this.suggestions[0]) {
    this.editing.set(null);
    this.typeForm.patchValue({ name: s.name, amount: s.amount, frequency: s.frequency });
  }

  save() {
    this.typeForm.markAllAsTouched();
    if (this.typeForm.invalid) return;
    this.saveLoading.set(true);
    this.formError.set('');
    const req: ContributionTypeRequest = this.typeForm.value;
    const obs = this.editing()
      ? this.typeSvc.update(this.editing()!.id, req)
      : this.typeSvc.create(req);
    obs.subscribe({
      next: () => {
        this.saveLoading.set(false);
        this.toast.success(this.editing() ? 'Category updated!' : 'Category created!');
        this.cancelEdit();
        this.load();
      },
      error: err => {
        this.saveLoading.set(false);
        this.formError.set(err.error?.message ?? 'Operation failed');
      }
    });
  }

  toggleActive(t: ContributionType) {
    this.typeSvc.toggleActive(t.id).subscribe({
      next: () => {
        this.toast.info(`${t.name} ${t.active ? 'deactivated' : 'activated'}`);
        this.load();
      },
      error: () => this.toast.error('Failed to update status')
    });
  }

  confirmDelete(t: ContributionType) {
    if (!confirm(`Delete "${t.name}"? Existing contributions will not be affected.`)) return;
    this.typeSvc.delete(t.id).subscribe({
      next: () => { this.toast.success('Category deleted'); this.load(); },
      error: () => this.toast.error('Failed to delete')
    });
  }

  generate() {
    if (!this.generatePeriod) return;
    this.generateLoading.set(true);
    this.contribSvc.generateForPeriod(this.generatePeriod).subscribe({
      next: msg => {
        this.generateLoading.set(false);
        this.toast.success(msg as string || `Contributions generated for ${this.generatePeriod}`);
      },
      error: err => {
        this.generateLoading.set(false);
        this.toast.error(err.error?.message ?? 'Generation failed');
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

  freqLabel(f: string) {
    return f === 'MONTHLY' ? 'Monthly' : f === 'ANNUAL' ? 'Annual' : 'One-Time';
  }
}
