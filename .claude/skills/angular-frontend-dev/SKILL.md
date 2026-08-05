---
name: angular-frontend-dev
description: >-
  Guía para desarrollar, revisar o refactorizar frontend en Angular 17 o superior (17, 18, 19+),
  usando las prácticas modernas del framework — componentes standalone, Signals, el nuevo control
  flow (@if/@for/@switch), inject(), arquitectura de proyecto y testing. Úsala siempre que el
  usuario mencione Angular, componentes de Angular, servicios, signals, standalone components,
  RxJS en Angular, testing de componentes Angular (Jest/Karma), o pida crear/generar/refactorizar
  código Angular, aunque no diga explícitamente "sigue las buenas prácticas". También aplica
  cuando el usuario pegue código Angular con NgModules, decoradores @Input/@Output clásicos o
  *ngIf/*ngFor y pida modernizarlo o migrarlo a la sintaxis actual.
---

# Desarrollo Frontend con Angular 17+

Skill para escribir y revisar código Angular moderno (v17+), priorizando siempre el estilo actual del framework sobre patrones antiguos (NgModules, decoradores clásicos de inputs, `*ngIf`/`*ngFor`), a menos que el usuario trabaje en un proyecto legacy y pida explícitamente mantener ese estilo.

## Cuándo usar cada referencia

Este SKILL.md cubre lo esencial y patrones rápidos. Para profundizar, consulta:

| Archivo | Cuándo leerlo |
|---|---|
| `references/signals.md` | Estado reactivo: `signal()`, `computed()`, `effect()`, `model()`, `input()`, `viewChild()` |
| `references/control-flow.md` | Sintaxis `@if`, `@for`, `@switch`, `@defer`, migración desde directivas estructurales |
| `references/architecture.md` | Estructura de carpetas, convenciones de nombres, `inject()`, lazy loading, routing standalone |
| `references/testing.md` | Testing de componentes con signals, TestBed, Jest vs Karma |

Lee el archivo relevante antes de escribir código en esa área específica; no asumas la sintaxis de memoria si hay dudas sobre una API nueva.

## Principios generales

1. **Standalone por defecto.** No generes `NgModule` salvo que el usuario esté en un proyecto que ya los usa. Todo componente, directiva y pipe se declara `standalone: true` (implícito desde Angular 19; explícito en 17-18).
2. **Signals para estado local**, no `BehaviorSubject` ni variables planas reactivas a mano. Usa RxJS para flujos asíncronos complejos (HTTP, websockets, combinaciones de eventos), y Signals para el estado que la plantilla renderiza.
3. **`inject()` sobre inyección por constructor** en código nuevo, especialmente en funciones standalone (guards, resolvers, interceptors) donde no hay clase.
4. **Nuevo control flow (`@if`/`@for`/`@switch`)** en vez de `*ngIf`/`*ngFor`/`*ngSwitch`. `@for` siempre requiere `track`.
5. **`input()` y `output()` como funciones** en vez de decoradores `@Input()`/`@Output()` cuando el proyecto ya está en Angular 17.3+ (donde son estables). Si el usuario está en 17.0-17.2, usa decoradores clásicos y menciónalo.
6. **Detección de cambios OnPush** por defecto en componentes nuevos — combina bien con signals porque no necesitas gestionar manualmente `markForCheck()`.
7. **Nombres de archivo modernos**: Angular 17+ eliminó el sufijo `.component` de los nombres por defecto en proyectos nuevos (`user-profile.ts` en vez de `user-profile.component.ts`), aunque ambos estilos son válidos. Si el usuario ya tiene un proyecto con un patrón establecido, respétalo; si es un proyecto nuevo, pregunta o usa el patrón por defecto de la CLI (`ng generate`).

## Patrón rápido: componente standalone moderno

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  imports: [], // aquí van otros componentes/directivas/pipes standalone que uses en el template
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button (click)="decrement()">-</button>
    <span>{{ count() }}</span>
    <button (click)="increment()">+</button>
    <p>Doble: {{ doubled() }}</p>
  `,
})
export class Counter {
  step = input<number>(1);
  countChanged = output<number>();

  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update(v => v + this.step());
    this.countChanged.emit(this.count());
  }

  decrement() {
    this.count.update(v => v - this.step());
    this.countChanged.emit(this.count());
  }
}
```

Puntos clave de este patrón:
- `imports: []` reemplaza declarar el componente en un `NgModule`.
- `input()`/`output()` reemplazan `@Input()`/`@Output()`.
- El template usa `{{ count() }}` — los signals se leen como funciones, no como propiedades planas.
- No hay constructor con inyección; si se necesitara un servicio, se usaría `private readonly foo = inject(FooService);` como propiedad de clase.

Para el nuevo control flow (`@if`/`@for`) y signals avanzados (`effect`, `linkedSignal`, `viewChild` con signals), consulta `references/control-flow.md` y `references/signals.md` — no los uses de memoria si tienes dudas sobre la sintaxis exacta.

## Flujo de trabajo sugerido

1. **Detecta la versión/estilo del proyecto** si el usuario compartió código existente: ¿usa NgModules? ¿decoradores clásicos? ¿`*ngIf`? Eso indica si están en un proyecto legacy o ya migrado.
2. **Si es código nuevo**, aplica directamente el estilo moderno de este skill sin preguntar.
3. **Si es una migración/refactor**, hazlo de forma incremental y explica los cambios (por ejemplo: "cambié `*ngFor` por `@for` con `track id`, que ahora es obligatorio").
4. **Para componentes con estado complejo o lógica de negocio**, separa esa lógica en un servicio inyectado con `inject()`, no la metas toda en el componente.
5. **Antes de escribir tests**, revisa `references/testing.md` — testear signals y componentes standalone tiene matices frente al testing clásico con `TestBed` de NgModules.

## Errores comunes a evitar

- Olvidar `track` en `@for` (es un error de compilación en Angular 17+, no solo una mala práctica).
- Mezclar `*ngIf` con `@if` en el mismo template sin razón — mantén consistencia.
- Leer un signal sin `()` en la plantilla o en TypeScript (`count` en vez de `count()`).
- Usar `effect()` para derivar estado que debería ser `computed()` — `effect()` es para efectos secundarios (logging, sincronizar con algo externo), no para calcular valores.
- Seguir inyectando por constructor en guards/resolvers funcionales, donde no existe una clase — ahí `inject()` es la única opción natural.
