import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { RealtimeService } from '../../core/realtime.service';
import { CATEGORIES, Draft, PRIORITIES, STATUSES, Ticket } from '../../core/models';
import { BadgeComponent, SourceComponent } from '../../shared/badges';

@Component({
  selector: 'app-ticket-detail',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, SourceComponent],
  template: `
    <a routerLink="/admin/tickets" class="muted">← Back to queue</a>
    @if (error()) { <div class="alert error">{{ error() }}</div> }
    @if (ticket(); as t) {
      <div class="row between">
        <h2>{{ t.ticketNumber }} · {{ t.subject }}</h2>
        <app-badge [value]="t.status" />
      </div>

      <div class="two">
        <section>
          <div class="card">
            <p class="muted small">From <b>{{ t.author.name }}</b> ({{ t.author.email }}) · {{ t.book?.title || 'General / Account Level' }}
              @if (t.book) { [{{ t.book.status }}] } · {{ t.createdAt | date: 'medium' }}</p>
            <div class="thread">
              <div class="msg author"><div class="who">{{ t.author.name }}</div><p>{{ t.description }}</p>
                @if (t.attachments.length) { <small class="muted">📎 {{ attachmentNames(t) }}</small> }
              </div>
              @for (m of t.messages; track m._id) {
                <div class="msg" [class.author]="m.sender === 'author'" [class.staff]="m.sender === 'admin'">
                  <div class="who">{{ m.senderName }} · {{ m.createdAt | date: 'short' }} @if (m.fromAiDraft) { <span class="src">AI draft</span> }</div>
                  <p>{{ m.body }}</p>
                </div>
              }
            </div>
          </div>

          <div class="card">
            <div class="row between">
              <h3>Reply to author</h3>
              <div class="row">
                @if (draft(); as d) {
                  <span class="src" [class.warn]="d.source === 'template'">{{ d.source === 'ai' ? 'AI draft' : 'Template draft (AI unavailable)' }}</span>
                }
                <button class="btn small ghost" (click)="loadDraft(true)" [disabled]="drafting()">↻ Regenerate</button>
              </div>
            </div>
            @if (drafting()) { <p class="muted">Drafting a response from the knowledge base…</p> }
            @if (draft()?.source === 'template') {
              <div class="alert warn">The AI service couldn't be reached, so this is a policy-based template. Please review and personalise it, or write your own.</div>
            }
            <textarea [(ngModel)]="replyText" rows="10" placeholder="Write a response…"></textarea>
            @if (replyError()) { <div class="alert error">{{ replyError() }}</div> }
            <div class="row">
              <button class="btn" (click)="send(t)" [disabled]="!replyText.trim() || sending() || t.status === 'Closed'">
                {{ sending() ? 'Sending…' : 'Send to author' }}
              </button>
              <label class="inline">then set status
                <select [(ngModel)]="nextStatus"><option value="">(auto)</option>@for (s of statuses; track s) { <option>{{ s }}</option> }</select>
              </label>
            </div>
          </div>
        </section>

        <aside>
          <div class="card">
            <h3>Triage</h3>
            <label>Status
              <select [ngModel]="t.status" (ngModelChange)="patch({ status: $event })">@for (s of statuses; track s) { <option>{{ s }}</option> }</select>
            </label>
            <label>Category <app-source [source]="t.categorySource" />
              <select [ngModel]="t.category" (ngModelChange)="patch({ category: $event })">@for (c of categories; track c) { <option>{{ c }}</option> }</select>
            </label>
            <label>Priority <app-source [source]="t.prioritySource" />
              <select [ngModel]="t.priority" (ngModelChange)="patch({ priority: $event })">@for (p of priorities; track p) { <option>{{ p }}</option> }</select>
            </label>
            @if (t.aiReason) { <p class="muted small">Why: {{ t.aiReason }}</p> }
            <div class="row">
              <button class="btn small ghost" (click)="reclassify()">Re-run AI triage</button>
            </div>
            <hr />
            <p>Assigned to: <b>{{ t.assignedTo?.name || 'Unassigned' }}</b></p>
            <button class="btn small ghost" (click)="patch({ assignedTo: 'me' })">Assign to me</button>
            @if (t.assignedTo) { <button class="btn small ghost" (click)="patch({ assignedTo: null })">Unassign</button> }
          </div>

          <div class="card notes">
            <h3>Internal notes <small class="muted">(not visible to author)</small></h3>
            @for (n of t.internalNotes; track n._id) {
              <div class="note"><b>{{ n.authorName }}</b> · {{ n.createdAt | date: 'short' }}<p>{{ n.body }}</p></div>
            } @empty { <p class="muted small">No notes yet.</p> }
            <textarea [(ngModel)]="noteText" rows="3" placeholder="Add a note…"></textarea>
            <button class="btn small" (click)="addNote(t)" [disabled]="!noteText.trim()">Add note</button>
          </div>
        </aside>
      </div>
    }
  `,
})
export class TicketDetailPage {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private realtime = inject(RealtimeService);
  private id = this.route.snapshot.paramMap.get('id')!;

  statuses = STATUSES; categories = CATEGORIES; priorities = PRIORITIES;
  ticket = signal<Ticket | null>(null);
  draft = signal<Draft | null>(null);
  drafting = signal(false);
  sending = signal(false);
  error = signal('');
  replyError = signal('');
  replyText = '';
  noteText = '';
  nextStatus = '';

  constructor() {
    this.fetch(true);
    this.realtime.events$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
      if (e.ticketId === this.id) this.fetch(false);
    });
  }

  attachmentNames = (t: Ticket) => t.attachments.map((a) => a.name).join(', ');

  private fetch(first: boolean) {
    this.api.ticket(this.id).subscribe({
      next: (r) => { this.ticket.set(r.ticket); if (first) this.loadDraft(false); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  loadDraft(regenerate: boolean) {
    this.drafting.set(true);
    this.api.draft(this.id, regenerate).subscribe({
      next: (r) => { this.draft.set(r.draft); this.replyText = r.draft.text; this.drafting.set(false); },
      // Graceful degradation: the admin can still write manually.
      error: (e) => { this.drafting.set(false); this.replyError.set(errorMessage(e)); },
    });
  }

  send(t: Ticket) {
    this.sending.set(true);
    this.replyError.set('');
    const unedited = this.draft()?.text === this.replyText;
    this.api.reply(t._id, this.replyText, { fromAiDraft: unedited && this.draft()?.source === 'ai', ...(this.nextStatus && { status: this.nextStatus }) }).subscribe({
      next: (r) => { this.ticket.set(r.ticket); this.replyText = ''; this.draft.set(null); this.nextStatus = ''; this.sending.set(false); },
      error: (e) => { this.replyError.set(errorMessage(e)); this.sending.set(false); },
    });
  }

  patch(p: Record<string, unknown>) {
    this.api.update(this.id, p).subscribe({
      next: (r) => this.ticket.set(r.ticket),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  addNote(t: Ticket) {
    this.api.addNote(t._id, this.noteText).subscribe({
      next: (r) => { this.ticket.set(r.ticket); this.noteText = ''; },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  reclassify() {
    this.api.reclassify(this.id).subscribe({
      next: (r) => this.ticket.set(r.ticket),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
