import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface SelectOption<T> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class Select<T> {
  label = input<string>('');
  /** 'default' matches a form field label; 'caption' matches a small uppercase filter label. */
  labelStyle = input<'default' | 'caption'>('default');
  options = input.required<readonly SelectOption<T>[]>();
  value = model.required<T>();

  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );

  protected onChange(event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    this.value.set(this.options()[index].value);
  }
}
