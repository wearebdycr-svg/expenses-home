# Testing en Angular 17+

Consulta este archivo antes de escribir tests para componentes standalone con signals. Los principios de `TestBed` no cambiaron drásticamente, pero hay matices con signals, `input()`/`output()`, y con el runner (Karma clásico vs Jest, cada vez más común en proyectos nuevos).

## Configuración básica con TestBed (componentes standalone)

Con componentes standalone, ya no se declara el componente en `declarations` — se importa directamente:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Counter } from './counter';

describe('Counter', () => {
  let fixture: ComponentFixture<Counter>;
  let component: Counter;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Counter], // el componente standalone se importa, no se declara
    }).compileComponents();

    fixture = TestBed.createComponent(Counter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('incrementa el contador', () => {
    component.increment();
    expect(component.count()).toBe(1); // leer el signal con ()
  });
});
```

## Testear componentes con `input()`

Los inputs basados en signal se setean con `fixture.componentRef.setInput(...)`, no asignando directamente la propiedad (que es de solo lectura desde fuera):

```typescript
fixture.componentRef.setInput('userId', 'abc-123');
fixture.detectChanges();

expect(component.userId()).toBe('abc-123');
```

```typescript
// Esto NO funciona, input() no es asignable directamente:
// component.userId = 'abc-123'; // Error de tipos
```

## Testear `output()`

```typescript
it('emite valueChanged al hacer click', () => {
  const spy = jest.fn(); // o jasmine.createSpy() si usas Karma/Jasmine
  component.valueChanged.subscribe(spy);

  component.save();

  expect(spy).toHaveBeenCalledWith('valor esperado');
});
```

## Testear `computed()` y `effect()`

- `computed()` se testea simplemente leyendo su valor tras cambiar sus dependencias — no requiere mocks especiales.
- `effect()` solo corre dentro de un injection context y de forma asíncrona (por defecto, en el siguiente ciclo de detección de cambios). Para forzar su ejecución en un test, usa `TestBed.flushEffects()` si está disponible en tu versión, o envuelve la aserción en `fixture.detectChanges()` seguido de `await fixture.whenStable()`.

```typescript
it('ejecuta el effect cuando cambia el signal', async () => {
  component.userId.set('nuevo-id');
  fixture.detectChanges();
  await fixture.whenStable();

  expect(mockAnalytics.track).toHaveBeenCalledWith('nuevo-id');
});
```

## Testear servicios con `inject()`

Nada cambia respecto al patrón clásico de testing de servicios — se sigue usando `TestBed.inject()` para obtener la instancia bajo test o sus dependencias mockeadas:

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('obtiene usuarios', () => {
    service.getUsers().subscribe();
    const req = httpMock.expectOne('/api/users');
    req.flush([{ id: 1, name: 'Ana' }]);
  });
});
```

## Jest vs Karma

Angular 17+ soporta un builder experimental/estable de Jest (`@angular/build:unit-test` o vía `@angular-builders/jest` según versión) además del Karma clásico. Si el usuario no especifica, pregunta o revisa `angular.json`/`package.json` para ver cuál está configurado en el proyecto — la API de aserciones difiere ligeramente:

| | Jest | Karma + Jasmine |
|---|---|---|
| Mock function | `jest.fn()` | `jasmine.createSpy()` |
| Spy en método existente | `jest.spyOn(obj, 'method')` | `spyOn(obj, 'method')` |
| Runner | Node, rápido, sin navegador real | Navegador real (Chrome headless típicamente) |

No mezcles sintaxis de Jest y Jasmine en el mismo archivo; detecta cuál usa el proyecto antes de escribir tests nuevos.

## Buenas prácticas generales

- Prefiere testear comportamiento observable (lo que el usuario ve/hace) sobre implementación interna — evita acceder a propiedades privadas del componente desde el test.
- Para componentes con `OnPush` (el default recomendado), recuerda llamar `fixture.detectChanges()` después de cada cambio de estado relevante, igual que con componentes clásicos.
- Si el componente usa `@defer`, en tests puedes forzar la resolución inmediata del bloque diferido con las utilidades de testing de `@angular/core/testing` (`TestBed` expone helpers para esto en versiones recientes) en vez de esperar el trigger real.
