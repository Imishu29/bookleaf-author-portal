import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, TicketFilters } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { RealtimeService } from '../../core/realtime.service';
import { CATEGORIES, PRIORITIES, STATUSES, Ticket } from '../../core/models';
import { BadgeComponent, SourceComponent } from '../../shared/badges';

@Component({
  selector: 'app-ticket-queue',
  imports: [DatePipe, FormsModule, BadgeComponent, SourceComponent],
  template: `
    <div class="row between">
      <h2>Ticket Queue <span class="live" title="Updates appear automatically">● live</span></h2>
      @if (stats(); as s) {
        <div class="chips">
          <span class="chip crit">{{ s.criticalActive }} critical open</span>
          <span class="chip">{{ s.status['Open'] }} open</span>
          <span class="chip">{{ s.status['In Progress'] }} in progress</span>
          <span class="chip">{{ s.unassignedActive }} unassigned</span>
        </div>
      }
    </div>

    <form class="filters card" (change)="reload()">
      <input name="q" [(ngModel)]="f.q" placeholder="Search subject / text / BL-number" (keyup.enter)="reload()" />
      <select name="status" [(ngModel)]="f.status"><option value="">All statuses</option>@for (s of statuses; track s) { <option>{{ s }}</option> }</select>
      <select name="category" [(ngModel)]="f.category"><option value="">All categories</option>@for (c of categories; track c) { <option>{{ c }}</option> }</select>
      <select name="priority" [(ngModel)]="f.priority"><option value="">All priorities</option>@for (p of priorities; track p) { <option>{{ p }}</option> }</select>
      <select name="assigned" [(ngModel)]="f.assigned">
        <option value="">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>
      </select>
      <label class="inline">From <input type="date" name="from" [(ngModel)]="f.from" /></label>
      <label class="inline">To <input type="date" name="to" [(ngModel)]="f.to" /></label>
      <select name="sort" [(ngModel)]="f.sort">
        <option value="urgency">Sort: Most urgent</option><option value="oldest">Sort: Oldest</option><option value="newest">Sort: Newest</option>
      </select>
      <button type="button" class="btn small ghost" (click)="clear()">Clear</button>
    </form>

    @if (error()) { <div class="alert error">{{ error() }}</div> }

    <table class="card table">
      <thead><tr><th>#</th><th>Subject</th><th>Author</th><th>Category</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Age</th></tr></thead>
      <tbody>
        @for (t of tickets(); track t._id) {
          <tr (click)="open(t)" [class.stale]="isStale(t)" [class.done]="t.status === 'Resolved' || t.status === 'Closed'">
            <td><b>{{ t.ticketNumber }}</b></td>
            <td class="subj">{{ t.subject }}<small class="muted">{{ t.book?.title || 'General / Account' }}</small></td>
            <td>{{ t.author.name }}</td>
            <td>{{ t.category }} <app-source [source]="t.categorySource" /></td>
            <td><app-badge [value]="t.priority" /> <app-source [source]="t.prioritySource" /></td>
            <td><app-badge [value]="t.status" /></td>
            <td>{{ t.assignedTo?.name || '—' }}</td>
            <td [title]="t.createdAt | date: 'medium'">{{ age(t) }}</td>
          </tr>
        } @empty {
          <tr><td colspan="8" class="empty">{{ loading() ? 'Loading…' : 'No tickets match these filters.' }}</td></tr>
        }
      </tbody>
    </table>
    <p class="muted small">{{ total() }} ticket(s). Rows highlighted amber have been waiting over 3 days.</p>
  `,
})
export class TicketQueuePage {
  private api = inject(ApiService);
  private router = inject(Router);
  private realtime = inject(RealtimeService);

  statuses = STATUSES; categories = CATEGORIES; priorities = PRIORITIES;
  f: Required<Pick<TicketFilters, 'q' | 'status' | 'category' | 'priority' | 'assigned' | 'from' | 'to' | 'sort'>> =
    { q: '', status: '', category: '', priority: '', assigned: '', from: '', to: '', sort: 'urgency' };

  tickets = signal<Ticket[]>([]);
  total = signal(0);
  stats = signal<{ status: Record<string, number>; criticalActive: number; unassignedActive: number } | null>(null);
  loading = signal(true);
  error = signal('');

  constructor() {
    this.reload();
    this.realtime.events$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.reload());
  }

  reload() {
    this.api.tickets({ ...this.f, to: this.f.to ? `${this.f.to}T23:59:59` : '', limit: 100 }).subscribe({
      next: (r) => { this.tickets.set(r.tickets); this.total.set(r.total); this.loading.set(false); this.error.set(''); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
    this.api.stats().subscribe((s) => this.stats.set(s));
  }

  clear() {
    this.f = { q: '', status: '', category: '', priority: '', assigned: '', from: '', to: '', sort: 'urgency' };
    this.reload();
  }

  open(t: Ticket) { this.router.navigate(['/admin/tickets', t._id]); }

  private ageDays = (t: Ticket) => (Date.now() - new Date(t.createdAt).getTime()) / 86_400_000;
  isStale = (t: Ticket) => (t.status === 'Open' || t.status === 'In Progress') && this.ageDays(t) > 3;
  age(t: Ticket) {
    const d = this.ageDays(t);
    return d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${Math.floor(d)}d`;
  }
}
