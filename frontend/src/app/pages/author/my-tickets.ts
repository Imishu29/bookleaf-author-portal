import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { RealtimeService } from '../../core/realtime.service';
import { Ticket } from '../../core/models';
import { BadgeComponent } from '../../shared/badges';

@Component({
  selector: 'app-my-tickets',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent],
  template: `
    <div class="row between">
      <h2>My Tickets <span class="live" title="Updates appear automatically">● live</span></h2>
      <a class="btn small" routerLink="/author/tickets/new">+ New query</a>
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }
    @if (!loading() && !tickets().length) {
      <div class="card empty">You haven't raised any queries yet. <a routerLink="/author/tickets/new">Submit your first query</a>.</div>
    }
    <div class="split">
      <ul class="list">
        @for (t of tickets(); track t._id) {
          <li [class.sel]="t._id === selectedId()" (click)="select(t._id)">
            <div class="row between"><b>{{ t.ticketNumber }}</b><app-badge [value]="t.status" /></div>
            <div>{{ t.subject }}</div>
            <small class="muted">{{ t.book?.title || 'General / Account Level' }} · {{ t.updatedAt | date: 'short' }}</small>
          </li>
        }
      </ul>

      @if (selected(); as t) {
        <section class="card detail">
          <div class="row between">
            <h3>{{ t.subject }}</h3><app-badge [value]="t.status" />
          </div>
          <p class="muted small">{{ t.ticketNumber }} · {{ t.book?.title || 'General / Account Level' }} · {{ t.createdAt | date: 'medium' }}
            @if (t.assignedTo) { · Handled by {{ t.assignedTo.name }} }</p>

          <div class="thread">
            <div class="msg author"><div class="who">You</div><p>{{ t.description }}</p>
              @if (t.attachments.length) { <small class="muted">📎 {{ names(t) }}</small> }
            </div>
            @for (m of t.messages; track m._id) {
              <div class="msg" [class.author]="m.sender === 'author'" [class.staff]="m.sender === 'admin'">
                <div class="who">{{ m.sender === 'author' ? 'You' : m.senderName }} · {{ m.createdAt | date: 'short' }}</div>
                <p>{{ m.body }}</p>
              </div>
            }
            @if (!t.messages.length) { <p class="muted small">No reply yet. Our team usually responds within 48 hours.</p> }
          </div>

          @if (t.status !== 'Closed') {
            <form (ngSubmit)="reply(t)">
              <textarea name="reply" [(ngModel)]="replyText" rows="3" placeholder="Add a follow-up…"></textarea>
              @if (replyError()) { <div class="alert error">{{ replyError() }}</div> }
              <button class="btn small" [disabled]="!replyText.trim() || sending()">Send</button>
            </form>
          } @else { <p class="muted">This ticket is closed. Please open a new query if you need more help.</p> }
        </section>
      }
    </div>
  `,
})
export class MyTicketsPage {
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);

  tickets = signal<Ticket[]>([]);
  selected = signal<Ticket | null>(null);
  selectedId = signal<string | null>(null);
  loading = signal(true);
  error = signal('');
  replyText = '';
  replyError = signal('');
  sending = signal(false);

  constructor() {
    this.load();
    // Near-real-time: refetch whenever the server says one of my tickets changed.
    this.realtime.events$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
      this.load();
      if (e.ticketId === this.selectedId()) this.fetchSelected();
    });
  }

  names = (t: Ticket) => t.attachments.map((a) => a.name).join(', ');

  load() {
    this.api.tickets({ sort: 'newest' }).subscribe({
      next: (r) => {
        this.tickets.set(r.tickets);
        this.loading.set(false);
        if (!this.selectedId() && r.tickets.length) this.select(r.tickets[0]._id);
      },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  select(id: string) {
    this.selectedId.set(id);
    this.replyText = '';
    this.fetchSelected();
  }

  private fetchSelected() {
    const id = this.selectedId();
    if (id) this.api.ticket(id).subscribe((r) => this.selected.set(r.ticket));
  }

  reply(t: Ticket) {
    this.sending.set(true);
    this.replyError.set('');
    this.api.reply(t._id, this.replyText).subscribe({
      next: (r) => { this.selected.set(r.ticket); this.replyText = ''; this.sending.set(false); this.load(); },
      error: (e) => { this.replyError.set(errorMessage(e)); this.sending.set(false); },
    });
  }
}
