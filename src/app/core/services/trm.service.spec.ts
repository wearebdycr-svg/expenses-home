import { TestBed } from '@angular/core/testing';
import { TrmService } from './trm.service';

describe('TrmService', () => {
  let service: TrmService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrmService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default or cached TRM rate', () => {
    expect(service.trm()).toBeGreaterThan(1000);
  });

  it('correctly converts USD to COP with current TRM', () => {
    const trm = 4000;
    const cop = service.convertUsdToCop(150, trm);
    expect(cop).toBe(600_000);
  });

  it('formats USD values clearly with US$ prefix and 2 decimals', () => {
    expect(service.formatUSD(150)).toBe('US$ 150.00');
    expect(service.formatUSD(1234.5)).toBe('US$ 1,234.50');
    expect(service.formatUSD(null)).toBe('—');
  });
});
