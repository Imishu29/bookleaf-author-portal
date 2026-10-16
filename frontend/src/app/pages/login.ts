import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="card login">
      <h1>📖 BookLeaf Support</h1>
      <p class="muted">Sign in to your portal</p>
      <form (ngSubmit)="submit()">
        <label>Email <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" /></label>
        <label>Password <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        @if (error()) { <div class="alert error">{{ error() }}</div> }
        <button class="btn" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <details class="demo">
        <summary>Demo accounts</summary>
        <p><b>Admin:</b> admin&#64;bookleaf.com / Admin&#64;123</p>
        <p><b>Author:</b> priya.sharma&#64;email.com / Author&#64;123</p>
        <p class="muted">All 10 authors use their dataset email with the same password.</p>
        <div class="row">
          <button type="button" class="btn small ghost" (click)="fill('admin@bookleaf.com', 'Admin@123')">Fill admin</button>
          <button type="button" class="btn small ghost" (click)="fill('priya.sharma@email.com', 'Author@123')">Fill author</button>
        </div>
      </details>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  constructor() {
    const u = this.auth.user();
    if (u) this.router.navigateByUrl(this.auth.homeFor(u));
  }

  fill(email: string, password: string) { this.email = email; this.password = password; }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: ({ user }) => this.router.navigateByUrl(this.auth.homeFor(user)),
      error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }
}
