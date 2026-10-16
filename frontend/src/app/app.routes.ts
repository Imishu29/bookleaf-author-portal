import { Routes } from '@angular/router';
import { roleGuard } from './core/guards';

// Lazy-loaded per portal so authors never download admin code.
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  {
    path: 'author',
    canActivate: [roleGuard('author')],
    children: [
      { path: 'books', loadComponent: () => import('./pages/author/my-books').then((m) => m.MyBooksPage) },
      { path: 'tickets/new', loadComponent: () => import('./pages/author/new-ticket').then((m) => m.NewTicketPage) },
      { path: 'tickets', loadComponent: () => import('./pages/author/my-tickets').then((m) => m.MyTicketsPage) },
      { path: '', pathMatch: 'full', redirectTo: 'books' },
    ],
  },
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    children: [
      { path: 'tickets', loadComponent: () => import('./pages/admin/ticket-queue').then((m) => m.TicketQueuePage) },
      { path: 'tickets/:id', loadComponent: () => import('./pages/admin/ticket-detail').then((m) => m.TicketDetailPage) },
      { path: '', pathMatch: 'full', redirectTo: 'tickets' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
