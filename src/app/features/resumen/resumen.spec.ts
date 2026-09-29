import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResumenPage } from './resumen';

describe('ResumenPage', () => {
  let component: ResumenPage;
  let fixture: ComponentFixture<ResumenPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumenPage],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the resumen page', () => {
    expect(component).toBeTruthy();
  });

  it('should display page title and subtitle', () => {
    const el = fixture.nativeElement;
    const title = el.querySelector('.page-title');
    const subtitle = el.querySelector('.page-subtitle');

    expect(title.textContent).toContain('Resumen Mensual');
    expect(subtitle.textContent).toContain('Balance de ingresos y gastos por mes');
  });

  it('should render all child sections (filters, kpis, charts, table)', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('app-resumen-filters')).toBeTruthy();
    expect(el.querySelector('app-resumen-kpis')).toBeTruthy();
    expect(el.querySelector('app-resumen-bar-chart')).toBeTruthy();
    expect(el.querySelector('app-resumen-line-chart')).toBeTruthy();
    expect(el.querySelector('app-resumen-table')).toBeTruthy();
  });
});
