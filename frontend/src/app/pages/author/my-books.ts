import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { Book } from '../../core/models';

@Component({
  selector: 'app-my-books',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <h2>My Books</h2>
    @if (error()) { <div class="alert error">{{ error() }}</div> }
    @if (loading()) { <p class="muted">Loading your books…</p> }
    @else if (!books().length && !error()) {
      <div class="card empty">No books on your account yet.</div>
    }
    <div class="grid">
      @for (b of books(); track b.bookId) {
        <article class="card book">
          <header>
            <h3>{{ b.title }}</h3>
            <span class="badge" [class.b-live]="isLive(b)" [class.b-production]="!isLive(b)">{{ b.status }}</span>
          </header>
          <dl>
            <dt>ISBN</dt><dd>{{ b.isbn }}</dd>
            <dt>Genre</dt><dd>{{ b.genre }}</dd>
            <dt>Published</dt><dd>{{ b.publicationDate ? (b.publicationDate | date: 'mediumDate') : 'Not yet published' }}</dd>
            <dt>MRP</dt><dd>{{ b.mrp != null ? (b.mrp | currency: 'INR' : 'symbol' : '1.0-0') : '—' }}</dd>
          </dl>
          @if (isLive(b)) {
            <div class="stats">
              <div><span>Copies sold</span><b>{{ b.totalCopiesSold }}</b></div>
              <div><span>Royalty earned</span><b>{{ b.totalRoyaltyEarned | currency: 'INR' : 'symbol' : '1.0-0' }}</b></div>
              <div><span>Paid</span><b>{{ b.royaltyPaid | currency: 'INR' : 'symbol' : '1.0-0' }}</b></div>
              <div [class.warn]="b.royaltyPending > 0"><span>Pending</span><b>{{ b.royaltyPending | currency: 'INR' : 'symbol' : '1.0-0' }}</b></div>
            </div>
            <p class="muted small">
              @if (b.lastRoyaltyPayoutDate) { Last payout: {{ b.lastRoyaltyPayoutDate | date: 'mediumDate' }}. }
              @else { No payout made yet. }
              Available on {{ b.availableOn.join(', ') }}.
            </p>
          } @else {
            <p class="muted small">This book is still in production, so there are no sales or royalties yet. We email you at every stage.</p>
          }
          <a class="btn small ghost" routerLink="/author/tickets/new" [queryParams]="{ book: b.bookId }">Raise a query about this book</a>
        </article>
      }
    </div>
  `,
})
export class MyBooksPage {
  private api = inject(ApiService);
  books = signal<Book[]>([]);
  loading = signal(true);
  error = signal('');

  constructor() {
    this.api.books().subscribe({
      next: (r) => { this.books.set(r.books); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  isLive = (b: Book) => b.status.startsWith('Published');
}
