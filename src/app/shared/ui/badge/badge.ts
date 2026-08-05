import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { hexToRgba } from '../../utils/color';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [style.color]="color()" [style.background-color]="background()">
      <ng-content />
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
  `,
})
export class Badge {
  color = input.required<string>();

  protected readonly background = computed(() => hexToRgba(this.color(), 0.12));
}
