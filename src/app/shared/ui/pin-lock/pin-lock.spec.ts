import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PinLock } from './pin-lock';
import { AuthPinService } from '../../../core/services/auth-pin.service';

describe('PinLock Component', () => {
  let component: PinLock;
  let fixture: ComponentFixture<PinLock>;
  let authService: AuthPinService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PinLock],
      providers: [AuthPinService],
    }).compileComponents();

    fixture = TestBed.createComponent(PinLock);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthPinService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('creates the component and starts with empty PIN', () => {
    expect(component).toBeTruthy();
    expect(component['pin']()).toBe('');
  });

  it('appends digits when buttons are clicked', () => {
    component['appendDigit']('1');
    component['appendDigit']('2');
    expect(component['pin']()).toBe('12');
  });

  it('deletes digits with deleteDigit()', () => {
    component['appendDigit']('1');
    component['appendDigit']('2');
    component['deleteDigit']();
    expect(component['pin']()).toBe('1');
  });

  it('clears pin with clearPin()', () => {
    component['appendDigit']('1');
    component['appendDigit']('2');
    component['clearPin']();
    expect(component['pin']()).toBe('');
  });

  it('automatically attempts submit and unlocks when 4 valid digits are entered', async () => {
    const unlockedSpy = vi.fn();
    component.unlocked.subscribe(unlockedSpy);

    // Default PIN is 2026
    component['appendDigit']('2');
    component['appendDigit']('0');
    component['appendDigit']('2');
    component['appendDigit']('6');

    await fixture.whenStable();
    expect(authService.isUnlocked()).toBe(true);
  });
});
