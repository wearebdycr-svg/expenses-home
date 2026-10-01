import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SplashScreen } from './splash-screen';

describe('SplashScreen', () => {
  let component: SplashScreen;
  let fixture: ComponentFixture<SplashScreen>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [SplashScreen],
    }).compileComponents();

    fixture = TestBed.createComponent(SplashScreen);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates the component and initializes at 0% progress', () => {
    expect(component).toBeTruthy();
    expect(component['progress']()).toBe(0);
    expect(component['isClosing']()).toBe(false);
  });

  it('updates progress over time, cycles steps, and completes after 1.5 seconds', () => {
    const completedSpy = vi.fn();
    component.completed.subscribe(completedSpy);

    // Avanzar ~450ms (~30% de 1500ms)
    vi.advanceTimersByTime(450);
    fixture.detectChanges();
    expect(component['progress']()).toBeGreaterThanOrEqual(24);
    expect(component['currentStep']().text).toContain('consumos');

    // Avanzar 750ms más (~80% total)
    vi.advanceTimersByTime(750);
    fixture.detectChanges();
    expect(component['progress']()).toBeGreaterThanOrEqual(74);

    // Completar el tiempo restante de 1500ms + 200ms de animación de salida
    vi.advanceTimersByTime(600);
    fixture.detectChanges();

    expect(component['progress']()).toBe(100);
    expect(component['isClosing']()).toBe(true);
    expect(completedSpy).toHaveBeenCalled();
  });
});
