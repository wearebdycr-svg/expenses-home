import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SplashStep {
  text: string;
  icon: string;
}

const SPLASH_STEPS: readonly SplashStep[] = [
  { text: 'Conectando con la base de datos del hogar...', icon: 'home' },
  { text: 'Cargando consumos diarios y presupuestos...', icon: 'receipt' },
  { text: 'Conciliando tarjetas de crédito y abonos...', icon: 'credit-card' },
  { text: 'Alineando metas y proyecciones financieras...', icon: 'trending-up' },
  { text: '¡Todo listo! Bienvenido a Expenses Home', icon: 'check-circle' },
];

const TOTAL_DURATION_MS = 1500;

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './splash-screen.html',
  styleUrl: './splash-screen.css',
})
export class SplashScreen {
  private readonly destroyRef = inject(DestroyRef);

  completed = output<void>();

  protected readonly progress = signal<number>(0);
  protected readonly currentStep = signal<SplashStep>(SPLASH_STEPS[0]);
  protected readonly isClosing = signal<boolean>(false);

  constructor() {
    this.startSplashTimer();
  }

  private startSplashTimer(): void {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / TOTAL_DURATION_MS) * 100));
      this.progress.set(pct);

      // Paso de estado según porcentaje
      if (pct < 24) {
        this.currentStep.set(SPLASH_STEPS[0]);
      } else if (pct < 48) {
        this.currentStep.set(SPLASH_STEPS[1]);
      } else if (pct < 72) {
        this.currentStep.set(SPLASH_STEPS[2]);
      } else if (pct < 94) {
        this.currentStep.set(SPLASH_STEPS[3]);
      } else {
        this.currentStep.set(SPLASH_STEPS[4]);
      }

      if (elapsed >= TOTAL_DURATION_MS) {
        clearInterval(intervalId);
        this.finish();
      }
    }, 16);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
    });
  }

  private finish(): void {
    this.progress.set(100);
    this.isClosing.set(true);
    setTimeout(() => {
      this.completed.emit();
    }, 200);
  }
}
