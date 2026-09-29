import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriaFilters } from './categoria-filters';
import { CategoriaService } from '../../data/categoria.service';

describe('CategoriaFilters', () => {
  let component: CategoriaFilters;
  let fixture: ComponentFixture<CategoriaFilters>;
  let categoriaService: CategoriaService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriaFilters],
    }).compileComponents();

    categoriaService = TestBed.inject(CategoriaService);
    fixture = TestBed.createComponent(CategoriaFilters);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the filters component', () => {
    expect(component).toBeTruthy();
  });

  it('should render TOTAL PERÍODO and CATEGORÍAS indicators', () => {
    const el = fixture.nativeElement as HTMLElement;
    const labels = el.querySelectorAll('.kpi-label');
    expect(labels[0].textContent).toContain('TOTAL PERÍODO');
    expect(labels[1].textContent).toContain('CATEGORÍAS');
  });
});
