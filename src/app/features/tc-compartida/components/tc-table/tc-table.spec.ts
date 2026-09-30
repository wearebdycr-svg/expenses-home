import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcTable } from './tc-table';
import { TcService } from '../../data/tc.service';

describe('TcTable', () => {
  let fixture: ComponentFixture<TcTable>;
  let component: TcTable;
  let tcService: TcService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TcTable],
    }).compileComponents();

    fixture = TestBed.createComponent(TcTable);
    component = fixture.componentInstance;
    tcService = TestBed.inject(TcService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders empty state when there are no consumptions', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders table rows when consumptions are present', () => {
    tcService.addTcExpense({
      date: '2026-07-10',
      person: 'Benny',
      description: 'Cena Restaurante',
      amount: 120_000,
      category: 'Restaurantes',
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeFalsy();
    expect(el.querySelectorAll('.tc-row').length).toBe(1);
    expect(el.querySelector('.col-description')?.textContent).toContain('Cena Restaurante');
  });

  it('emits edit when edit button is clicked', () => {
    tcService.addTcExpense({
      date: '2026-07-10',
      person: 'Benny',
      description: 'Gasolina',
      amount: 80_000,
    });

    fixture.detectChanges();

    const editSpy = vi.spyOn(component.edit, 'emit');
    const editBtn = fixture.nativeElement.querySelector('.icon-btn--edit') as HTMLButtonElement;
    editBtn.click();

    expect(editSpy).toHaveBeenCalled();
  });
});
