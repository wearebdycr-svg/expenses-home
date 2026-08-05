# Arquitectura y Estructura de Proyecto (Angular 17+)

Consulta este archivo para decisiones de organización de carpetas, inyección de dependencias moderna y routing con componentes standalone.

## Estructura de carpetas recomendada

Para proyectos nuevos sin convención propia, organiza por **feature**, no por tipo de archivo:

```
src/app/
├── core/                  # servicios singleton, interceptors, guards globales
│   ├── interceptors/
│   ├── guards/
│   └── services/
├── shared/                 # componentes/pipes/directivas reutilizables entre features
│   ├── ui/
│   └── pipes/
├── features/
│   ├── users/
│   │   ├── users.routes.ts
│   │   ├── user-list/
│   │   │   ├── user-list.ts
│   │   │   └── user-list.spec.ts
│   │   ├── user-detail/
│   │   └── services/
│   │       └── users.service.ts
│   └── dashboard/
│       └── ...
├── app.config.ts
├── app.routes.ts
└── app.ts
```

Evita `models/`, `services/`, `components/` como carpetas de primer nivel para toda la app — eso agrupa por tipo técnico en vez de por dominio, y dificulta encontrar todo lo relacionado a una feature. Dentro de cada feature sí es razonable tener sub-carpetas técnicas pequeñas (`services/`, `models/`) si la feature crece.

## `app.config.ts` — bootstrap sin NgModules

Angular 17+ usa `bootstrapApplication` con un `ApplicationConfig` en vez de `AppModule`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig);
```

## `inject()` en vez de inyección por constructor

```typescript
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class UsersService {
  private readonly http = inject(HttpClient);

  getUsers() {
    return this.http.get<User[]>('/api/users');
  }
}
```

Es especialmente necesario (no solo preferido) en contextos funcionales sin clase, como guards e interceptors:

```typescript
// guard funcional
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.parseUrl('/login');
};
```

```typescript
// interceptor funcional
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(cloned);
};
```

## Routing standalone y lazy loading

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
  },
];
```

```typescript
// features/users/users.routes.ts
import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./user-list/user-list').then(m => m.UserList) },
  { path: ':id', loadComponent: () => import('./user-detail/user-detail').then(m => m.UserDetail) },
];
```

- `loadComponent` reemplaza la necesidad de un `NgModule` de feature solo para lazy loading.
- `loadChildren` apuntando a un array de `Routes` (no a un módulo) sigue funcionando igual para agrupar sub-rutas de una feature.

## Servicios: `providedIn: 'root'` sigue siendo la norma

```typescript
@Injectable({ providedIn: 'root' })
export class UsersService { ... }
```

Sigue siendo el patrón correcto para servicios singleton — nada cambió aquí con standalone. Solo evita proveerlos manualmente en un `NgModule` porque, en un proyecto standalone, probablemente no exista uno.
