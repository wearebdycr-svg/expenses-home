import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcFilters } from './tc-filters';
import { TcService } from '../../data/tc.service';

describe('TcFilters Component', () => {
  let component: TcFilters;
  let fixture: ComponentFixture<TcFilters>;
  let tcService: TcService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TcFilters],
    }).compileComponents();

    tcService = TestBed.inject(TcService);
    fixture = TestBed.createComponent(TcFilters);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('updates year, month, and day in TcService when changed', () => {
    tcService.setYear(2026);
    tcService.setMonth(7);
    tcService.setDay(15);
    tcService.setPerson('Benny');

    expect(tcService.year()).toBe(2026);
    expect(tcService.month()).toBe(7);
    expect(tcService.day()).toBe(15);
    expect(tcService.person()).toBe('Benny');
  });
});
