const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ACTIVE_STATUSES = ['Open', 'In Progress'];

module.exports = { CATEGORIES, PRIORITIES, PRIORITY_RANK, STATUSES, ACTIVE_STATUSES };
