import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { Book } from '../../core/models';

@Component({
  selector: 'app-new-ticket',
  imports: [FormsModule],
  template: `
    <h2>Submit a Support Query</h2>
    <form class="card form" (ngSubmit)="submit()">
      <label>Which book is this about?
        <select name="book" [(ngModel)]="bookId">
          <option [ngValue]="null">General / Account Level</option>
          @for (b of books(); track b.bookId) { <option [ngValue]="b.bookId">{{ b.title }}</option> }
        </select>
      </label>
      <label>Subject
        <input name="subject" [(ngModel)]="subject" maxlength="150" required placeholder="e.g. Royalty for Q3 not received" />
      </label>
      <label>Describe your query
        <textarea name="description" [(ngModel)]="description" rows="7" required maxlength="5000"
          placeholder="Please include what you expected, what happened, and any dates or amounts."></textarea>
        <small class="muted">{{ description.length }}/5000 · minimum 20 characters</small>
      </label>
      <label>Attachments (optional)
        <input type="file" multiple (change)="pick($event)" />
        <small class="muted">Only file names are recorded for now; upload is not enabled yet.</small>
      </label>
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      <div class="row">
        <button class="btn" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit query' }}</button>
      </div>
    </form>
  `,
})
export class NewTicketPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  books = signal<Book[]>([]);
  bookId: string | null = this.route.snapshot.queryParamMap.get('book');
  subject = '';
  description = '';
  files: { name: string; size: number }[] = [];
  busy = signal(false);
  error = signal('');

  constructor() {
    this.api.books().subscribe((r) => this.books.set(r.books));
  }

  pick(e: Event) {
    const list = (e.target as HTMLInputElement).files;
    this.files = Array.from(list ?? []).slice(0, 5).map((f) => ({ name: f.name, size: f.size }));
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.api.createTicket({ bookId: this.bookId, subject: this.subject, description: this.description, attachments: this.files }).subscribe({
      next: () => this.router.navigateByUrl('/author/tickets'),
      error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }
}
