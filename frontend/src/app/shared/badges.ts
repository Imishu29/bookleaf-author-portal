import { Component, input } from '@angular/core';

/** Colour-coded pill for status / priority values. */
@Component({
  selector: 'app-badge',
  template: `<span class="badge" [class]="cls()">{{ value() }}</span>`,
})
export class BadgeComponent {
  value = input.required<string>();
  cls = () => 'b-' + this.value().toLowerCase().replace(/\s+/g, '-');
}

/** Tiny label showing who set a triage value ("AI", "Rules", "Admin"). */
@Component({
  selector: 'app-source',
  template: `@if (label(); as l) { <span class="src" [title]="title()">{{ l }}</span> }`,
})
export class SourceComponent {
  source = input<string | undefined>();
  label = () => ({ ai: 'AI', rules: 'Auto', admin: 'Admin', pending: 'AI…' } as Record<string, string>)[this.source() ?? ''] ?? '';
  title = () => ({
    ai: 'Set by the AI model', rules: 'Set by rule-based fallback (AI unavailable)',
    admin: 'Overridden by an admin', pending: 'Classification in progress',
  } as Record<string, string>)[this.source() ?? ''] ?? '';
}
