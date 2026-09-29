import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriaPage } from './categoria';

describe('CategoriaPage', () => {
  let component: CategoriaPage;
  let fixture: ComponentFixture<CategoriaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the categoria page', () => {
    expect(component).toBeTruthy();
  });

  it('should render header and sections', () => {
    const el = fixture.nativeElement as HTMLElement;
    const title = el.querySelector('.page-title');
    const subtitle = el.querySelector('.page-subtitle');

    expect(title?.textContent).toContain('Gastos por Categoría');
    expect(subtitle?.textContent).toContain('Análisis de distribución de gastos');

    expect(el.querySelector('app-categoria-filters')).toBeTruthy();
    expect(el.querySelector('app-categoria-donut-chart')).toBeTruthy();
    expect(el.querySelector('app-categoria-bar-chart')).toBeTruthy();
    expect(el.querySelector('app-categoria-table')).toBeTruthy();
  });
});
