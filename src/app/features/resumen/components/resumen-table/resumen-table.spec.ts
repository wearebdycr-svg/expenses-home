import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResumenTable } from './resumen-table';
import { ResumenService } from '../../data/resumen.service';

describe('ResumenTable', () => {
  let component: ResumenTable;
  let fixture: ComponentFixture<ResumenTable>;
  let resumenService: ResumenService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumenTable],
    }).compileComponents();

    resumenService = TestBed.inject(ResumenService);
    fixture = TestBed.createComponent(ResumenTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the table component', () => {
    expect(component).toBeTruthy();
  });

  it('should render 12 monthly rows in the table', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr.resumen-row');
    expect(rows.length).toBe(12);
  });

  it('should display the current year in table title', () => {
    const title = fixture.nativeElement.querySelector('.table-title');
    expect(title.textContent).toContain(String(resumenService.year()));
  });
});
