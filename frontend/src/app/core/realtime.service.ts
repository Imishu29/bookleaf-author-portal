import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';

export interface TicketEvent { type: string; ticketId: string }

/**
 * Wraps the server's SSE stream. EventSource reconnects automatically, so brief
 * network drops are invisible to the user. Emits only ids; components refetch.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private source: EventSource | null = null;
  private subject = new Subject<TicketEvent>();

  readonly events$: Observable<TicketEvent> = this.subject.asObservable();

  connect() {
    if (this.source || !this.auth.token) return;
    this.source = new EventSource(`/api/events?token=${encodeURIComponent(this.auth.token)}`);
    for (const type of ['ticket.created', 'ticket.updated']) {
      this.source.addEventListener(type, (e) => {
        const { ticketId } = JSON.parse((e as MessageEvent).data);
        this.zone.run(() => this.subject.next({ type, ticketId }));
      });
    }
  }

  disconnect() {
    this.source?.close();
    this.source = null;
  }
}
