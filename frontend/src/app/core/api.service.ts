import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Book, Draft, Ticket } from './models';

export interface TicketFilters {
  status?: string; category?: string; priority?: string; assigned?: string;
  from?: string; to?: string; q?: string; sort?: string; page?: number; limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  books() { return this.http.get<{ books: Book[] }>('/api/books'); }

  tickets(filters: TicketFilters = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<{ tickets: Ticket[]; total: number; page: number; limit: number }>('/api/tickets', { params });
  }
  ticket(id: string) { return this.http.get<{ ticket: Ticket }>(`/api/tickets/${id}`); }
  stats() {
    return this.http.get<{ status: Record<string, number>; criticalActive: number; unassignedActive: number }>('/api/tickets/stats/summary');
  }

  createTicket(body: { bookId: string | null; subject: string; description: string; attachments: { name: string; size: number }[] }) {
    return this.http.post<{ ticket: Ticket }>('/api/tickets', body);
  }
  reply(id: string, body: string, extra: { fromAiDraft?: boolean; status?: string } = {}) {
    return this.http.post<{ ticket: Ticket }>(`/api/tickets/${id}/messages`, { body, ...extra });
  }
  update(id: string, patch: Record<string, unknown>) { return this.http.patch<{ ticket: Ticket }>(`/api/tickets/${id}`, patch); }
  addNote(id: string, body: string) { return this.http.post<{ ticket: Ticket }>(`/api/tickets/${id}/notes`, { body }); }
  draft(id: string, regenerate = false) {
    return this.http.post<{ draft: Draft }>(`/api/tickets/${id}/ai-draft`, {}, { params: { regenerate } });
  }
  reclassify(id: string) { return this.http.post<{ ticket: Ticket }>(`/api/tickets/${id}/reclassify`, {}); }
}
