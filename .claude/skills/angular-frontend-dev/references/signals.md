# Signals en Angular 17+

Guía de referencia para el sistema de reactividad basado en Signals. Consulta este archivo antes de escribir código que use `signal`, `computed`, `effect`, `input`, `output`, `model`, `viewChild`/`viewChildren`, o `linkedSignal`.

## `signal()` — estado reactivo básico

```typescript
import { signal } from '@angular/core';

const count = signal(0);

count();           // leer el valor: 0
count.set(5);       // sobrescribir
count.update(v => v + 1); // actualizar a partir del valor anterior
```

- Un signal **siempre se lee llamándolo como función**: `count()`, nunca `count`.
- Para objetos/arrays, trata el valor como inmutable: usa `update()` devolviendo una copia nueva, no mutes el objeto interno directamente (si mutas, la detección de cambios no se dispara correctamente).

```typescript
const items = signal<string[]>([]);
items.update(list => [...list, 'nuevo item']); // correcto
// items().push('nuevo item'); // evitar: mutación directa
```

## `computed()` — valores derivados

```typescript
import { computed, signal } from '@angular/core';

const price = signal(100);
const quantity = signal(2);
const total = computed(() => price() * quantity());
```

- Es de solo lectura, se recalcula automáticamente solo cuando cambian sus dependencias (`price` o `quantity` en este caso), y memoiza el resultado.
- No tiene efectos secundarios: no llames a `console.log`, HTTP, ni mutaciones dentro de un `computed()`. Para eso está `effect()`.

## `effect()` — efectos secundarios

```typescript
import { effect, signal } from '@angular/core';

const userId = signal<string | null>(null);

effect(() => {
  console.log('El usuario cambió a:', userId());
  // sincronizar con localStorage, analytics, etc.
});
```

- Se ejecuta automáticamente cuando cambian los signals que lee dentro del cuerpo.
- Por defecto solo se puede crear en un "injection context" (constructor de componente/servicio, o campo de clase inicializado ahí). Si necesitas crearlo fuera, usa la opción `{ injector }`.
- No uses `effect()` para propagar estado a otro signal — para eso está `computed()` o, si de verdad necesitas escribir un signal a partir de otro con lógica más compleja, `linkedSignal()`.

## `input()` — reemplazo de `@Input()`

```typescript
import { input } from '@angular/core';

// Input opcional con valor por defecto
label = input('Enviar');

// Input requerido
userId = input.required<string>();

// Con transformación
disabled = input(false, { transform: (v: boolean | string) => !!v });
```

- Se lee igual que cualquier signal: `this.label()`.
- `input.required<T>()` falla en tiempo de compilación/ejecución si el padre no lo provee.
- Reemplaza tanto `@Input()` como `@Input() set foo(...)` (usa `computed()` sobre el input si necesitas transformarlo).

## `output()` — reemplazo de `@Output()`

```typescript
import { output } from '@angular/core';

saved = output<void>();
valueChanged = output<string>();

// emitir
this.saved.emit();
this.valueChanged.emit('nuevo valor');
```

- No usa `EventEmitter` directamente en la firma pública (aunque por dentro lo use); no necesitas importar `EventEmitter` para esto.

## `model()` — two-way binding

```typescript
import { model } from '@angular/core';

checked = model(false); // en el padre: <app-toggle [(checked)]="isActive" />
```

- Combina lectura (`checked()`) y escritura (`checked.set(true)`), y sincroniza automáticamente con el padre vía `[(checked)]`.
- Reemplaza el patrón clásico de `@Input() checked` + `@Output() checkedChange`.

## `viewChild()` / `viewChildren()` basados en signal

```typescript
import { viewChild, ElementRef } from '@angular/core';

inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
// en el template: <input #searchInput />

focus() {
  this.inputRef()?.nativeElement.focus();
}
```

- Reemplaza `@ViewChild()`. El valor es `undefined` hasta que la vista se inicializa — siempre verifica con `?.` o `computed()`.
- Existe también `viewChild.required(...)` cuando garantizas que siempre existirá.

## `linkedSignal()` — estado derivado pero escribible

Úsalo cuando necesitas un signal que se resetea automáticamente en función de otro, pero que el usuario también puede sobrescribir manualmente (ej.: una selección que se resetea cuando cambia la lista de opciones, pero que el usuario puede cambiar dentro de esa lista).

```typescript
import { linkedSignal, signal } from '@angular/core';

const options = signal(['a', 'b', 'c']);
const selected = linkedSignal(() => options()[0]); // se resetea si `options` cambia
selected.set('b'); // pero el usuario puede sobrescribirlo mientras tanto
```

## Signals vs RxJS: cuándo usar cada uno

| Caso de uso | Herramienta recomendada |
|---|---|
| Estado de UI local (formularios, toggles, contadores) | `signal()` |
| Valor derivado sincrónicamente de otro estado | `computed()` |
| Petición HTTP, websocket, evento de scroll/resize | RxJS (`Observable`) |
| Combinar streams complejos (`debounceTime`, `switchMap`, `combineLatest`) | RxJS |
| Convertir un Observable en signal para consumir en template | `toSignal()` de `@angular/core/rxjs-interop` |
| Convertir un signal en Observable para pipes RxJS | `toObservable()` de `@angular/core/rxjs-interop` |

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
```

No reemplaces RxJS por completo — para HTTP y flujos asíncronos complejos sigue siendo la herramienta correcta. Signals son para el estado síncrono que la plantilla lee directamente.
