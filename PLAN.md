# PLAN.md - Plan de Estabilización y Refactorización

## Wave 0: Red de Seguridad y Diagnóstico
- [X] 0.1 Diagnóstico de tipos y linter: ejecutar compilación estática y listar advertencias/errores sin modificar la lógica.
- [X] 0.2 Pruebas de humo críticas: crear 1 o 2 tests básicos que confirmen que la lógica central actual sigue funcionando intacta.

## Wave 1: Modularización Atómica
- [ ] 1.1 Extraer la lógica de negocio dispersa del componente/archivo principal hacia un módulo/servicio independiente.
- [ ] 1.2 Añadir tipado estricto a las entradas y salidas de datos de ese módulo extraído.
- [ ] 1.3 Verificar que el flujo original funcione sin cambios visuales ni regresiones.