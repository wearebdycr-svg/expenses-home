# Nuevo Control Flow (@if / @for / @switch / @defer)

Sintaxis de plantilla nativa introducida en Angular 17, estable y recomendada sobre las directivas estructurales clásicas (`*ngIf`, `*ngFor`, `*ngSwitch`). Consulta este archivo antes de escribir o migrar plantillas.

## `@if`

```angular17html
@if (user(); as u) {
  <p>Hola, {{ u.name }}</p>
} @else if (isLoading()) {
  <p>Cargando...</p>
} @else {
  <p>No hay usuario</p>
}
```

- `as u` captura el valor evaluado (útil con signals u observables via `async`) para no repetir la llamada.
- `@else if` y `@else` son nativos, sin necesidad de `<ng-template>`.

Equivalente antiguo a evitar en código nuevo:
```angular17html
<p *ngIf="user() as u; else loading">Hola, {{ u.name }}</p>
<ng-template #loading><p>Cargando...</p></ng-template>
```

## `@for`

```angular17html
@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>No hay elementos</li>
}
```

- **`track` es obligatorio** — es un error de compilación omitirlo. Usa un identificador estable (`item.id`), nunca el índice salvo que la lista sea estática y sin reordenamientos (`track $index` como último recurso).
- `@empty` reemplaza el patrón manual de comprobar `items.length === 0` por separado.
- Variables de contexto disponibles dentro del bloque: `$index`, `$first`, `$last`, `$even`, `$odd`, `$count`.

```angular17html
@for (item of items(); track item.id; let i = $index, isFirst = $first) {
  <li [class.first]="isFirst">{{ i }}: {{ item.name }}</li>
}
```

Equivalente antiguo a evitar:
```angular17html
<li *ngFor="let item of items(); trackBy: trackById">{{ item.name }}</li>
```
(con `@for` ya no necesitas una función `trackBy` aparte en la clase; la expresión de tracking va inline).

## `@switch`

```angular17html
@switch (status()) {
  @case ('loading') {
    <app-spinner />
  }
  @case ('error') {
    <app-error-banner />
  }
  @default {
    <app-content />
  }
}
```

- No necesita `[ngSwitch]` en el elemento contenedor; `@switch` ya define el ámbito.

## `@defer` — carga diferida de bloques de plantilla

Permite dividir el bundle y cargar partes de la UI de forma perezosa, sin necesidad de lazy loading a nivel de ruta.

```angular17html
@defer (on viewport) {
  <app-heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="chart-placeholder">Gráfico</div>
} @loading (minimum 200ms) {
  <app-spinner />
} @error {
  <p>No se pudo cargar el gráfico</p>
}
```

Triggers disponibles para `@defer (on ...)`:
- `idle` (por defecto): cuando el navegador está inactivo.
- `viewport`: cuando el bloque entra en el viewport.
- `interaction`: al hacer click/keydown sobre el placeholder.
- `hover`: al pasar el mouse sobre el placeholder.
- `timer(Xs)`: tras un tiempo fijo.
- `immediate`: en cuanto sea posible tras el render inicial.

También soporta `when <expresión>` para condiciones custom, y se puede combinar con `prefetch on ...` para precargar el código sin renderizar aún.

Usa `@defer` para componentes pesados que no son críticos en el primer render: gráficos, editores de texto enriquecido, modales complejos, contenido "below the fold".

## Checklist de migración desde directivas estructurales

Al migrar código legacy, revisa:
1. ¿Hay `*ngIf="x; else y"`? → `@if (x) {...} @else {...}`.
2. ¿Hay `*ngFor` sin `trackBy`? → añade `track` obligatoriamente al migrar a `@for` (no lo omitas aunque el original no lo tuviera).
3. ¿Hay `[ngSwitch]`/`*ngSwitchCase`? → `@switch`/`@case`/`@default`.
4. ¿El componente importaba `CommonModule` solo por estas directivas? Si ya no usa `NgIf`/`NgFor`/`NgSwitch` ni otras utilidades de `CommonModule` (como pipes `async`, `date`, etc.), puede quitarse del array `imports`.
5. Angular ofrece un schematic automático: `ng generate @angular/core:control-flow` migra un proyecto completo — menciónalo al usuario si va a migrar un proyecto grande en vez de hacerlo archivo por archivo a mano.
