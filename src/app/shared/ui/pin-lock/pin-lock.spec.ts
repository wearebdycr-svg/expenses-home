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

  it('allows setting initial custom PIN without default 2026 and then unlocks on 4 digits', async () => {
    component['openChangeModal']();
    component['changeNewPin'].set('4821');
    component['changeConfirmPin'].set('4821');
    await component['submitChangePin']();

    expect(authService.hasCustomPin()).toBe(true);

    const unlockedSpy = vi.fn();
    component.unlocked.subscribe(unlockedSpy);

    component['appendDigit']('4');
    component['appendDigit']('8');
    component['appendDigit']('2');
    component['appendDigit']('1');

    await vi.waitFor(() => {
      expect(authService.isUnlocked()).toBe(true);
    });
    expect(unlockedSpy).toHaveBeenCalledTimes(1);
  });

  it('emits signOutSupabase when clicking sign out button', () => {
    const signOutSpy = vi.fn();
    component.signOutSupabase.subscribe(signOutSpy);

    const signOutBtn = fixture.nativeElement.querySelector('.btn-signout-link') as HTMLButtonElement;
    signOutBtn.click();

    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
