import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { RealtimeService } from './core/realtime.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  auth = inject(AuthService);
  private realtime = inject(RealtimeService);
  router = inject(Router);

  constructor() {
    // Open the live stream while logged in; close it on logout.
    effect(() => {
      if (this.auth.user()) this.realtime.connect();
      else this.realtime.disconnect();
    });
  }
}
