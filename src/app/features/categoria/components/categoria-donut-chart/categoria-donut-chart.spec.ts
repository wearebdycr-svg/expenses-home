import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriaDonutChart } from './categoria-donut-chart';
import { CategoriaService } from '../../data/categoria.service';

describe('CategoriaDonutChart', () => {
  let component: CategoriaDonutChart;
  let fixture: ComponentFixture<CategoriaDonutChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriaDonutChart],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriaDonutChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the donut chart component', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when there are no expenses', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
