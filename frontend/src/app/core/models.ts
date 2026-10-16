export type Role = 'author' | 'admin';
export type Status = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type Source = 'pending' | 'ai' | 'rules' | 'admin';

export const STATUSES: Status[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
export const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

export interface User { id: string; email: string; name: string; role: Role; author: string | null }

export interface Book {
  bookId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  mrp: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  availableOn: string[];
}

export interface Message { _id: string; sender: Role; senderName: string; body: string; createdAt: string; fromAiDraft?: boolean }
export interface Note { _id: string; authorName: string; body: string; createdAt: string }

export interface Ticket {
  _id: string;
  ticketNumber: string;
  author: { authorId: string; name: string; email: string };
  book: { bookId: string; title: string; status: string } | null;
  subject: string;
  description: string;
  attachments: { name: string; size: number }[];
  status: Status;
  category: string;
  priority: Priority;
  categorySource?: Source;
  prioritySource?: Source;
  aiReason?: string;
  assignedTo: { _id?: string; name: string } | null;
  messages: Message[];
  internalNotes?: Note[];
  createdAt: string;
  updatedAt: string;
}

export interface Draft { text: string; source: 'ai' | 'template'; generatedAt: string }
