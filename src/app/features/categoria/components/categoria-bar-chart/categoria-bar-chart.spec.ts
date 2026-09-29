import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriaBarChart } from './categoria-bar-chart';
import { CategoriaService } from '../../data/categoria.service';

describe('CategoriaBarChart', () => {
  let component: CategoriaBarChart;
  let fixture: ComponentFixture<CategoriaBarChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriaBarChart],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriaBarChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the bar chart component', () => {
    expect(component).toBeTruthy();
  });

  it('should render empty state when there are no category rows', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
