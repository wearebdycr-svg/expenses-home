import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriaTable } from './categoria-table';
import { CategoriaService } from '../../data/categoria.service';

describe('CategoriaTable', () => {
  let component: CategoriaTable;
  let fixture: ComponentFixture<CategoriaTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriaTable],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriaTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the table component', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when there are no category rows', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
