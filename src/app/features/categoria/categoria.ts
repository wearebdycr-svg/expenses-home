import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriaBarChart } from './components/categoria-bar-chart/categoria-bar-chart';
import { CategoriaDonutChart } from './components/categoria-donut-chart/categoria-donut-chart';
import { CategoriaFilters } from './components/categoria-filters/categoria-filters';
import { CategoriaTable } from './components/categoria-table/categoria-table';
import { CategoryBudgetModal } from './components/category-budget-modal/category-budget-modal';

@Component({
  selector: 'app-categoria-page',
  standalone: true,
  imports: [
    CommonModule,
    CategoriaFilters,
    CategoriaDonutChart,
    CategoriaBarChart,
    CategoriaTable,
    CategoryBudgetModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categoria.html',
  styleUrl: './categoria.css',
})
export class CategoriaPage {
  readonly isBudgetModalOpen = signal<boolean>(false);
  readonly selectedCategoryForBudget = signal<string | null>(null);

  openBudgetModal(category?: string): void {
    this.selectedCategoryForBudget.set(category ?? null);
    this.isBudgetModalOpen.set(true);
  }

  closeBudgetModal(): void {
    this.isBudgetModalOpen.set(false);
  }
}
