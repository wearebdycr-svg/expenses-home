HU-002: Módulo de Resumen Mensual y Balance Anual
ID: HU-004
Título: Visualización de Resumen Mensual, Comparativo Ingresos vs Gastos y Saldo Acumulado
Historia de Usuario
Como usuario registrado de la aplicación web de finanzas del hogar, 
Quiero consultar una vista consolidada de ingresos, gastos, tasa de ahorro y saldo acumulado mes a mes, 
Para evaluar el desempeño financiero del hogar, analizar tendencias de ahorro y tomar decisiones presupuestarias. 
Criterios de Aceptación Funcionales
1. Barra de Filtros y Tarjetas de Resumen Superior
	Criterio 1.1: Filtros por Año y Persona (lista dinámica de integrantes o "Todos"). 
	Criterio 1.2 Indicadores dinámicos superiores:
	TOTAL INGRESOS: Suma acumulada de todos los ingresos del período (destacado en verde). 
	TOTAL GASTOS: Suma acumulada de todos los gastos del período (destacado en rojo). 
	BALANCE YTD (Year-To-Date): Resultado de Total Ingresos - Total Gastos (verde si es ≥0, rojo si es <0). 
	Criterio 1.3 KPIs de Promedios y Tasa de Ahorro:
	PROMEDIO INGRESOS/MES: Calculado dinámicamente como Total Ingresos / Cantidad de meses con registro. 
	PROMEDIO GASTOS/MES: Calculado dinámicamente como Total Gastos / Cantidad de meses con registro. 
	TASA DE AHORRO: Porcentaje global calculado como ((Total Ingresos - Total Gastos) / Total Ingresos) * 100. 
2. Visualización Gráfica (Dashboard Comparativo)
	Criterio 2.1 (Gráfico de Barras - Ingresos vs Gastos por mes) [Corrección Visual]:
	Presenta dos barras agrupadas por mes:
	Barra de Ingresos: Representada en color verde. 
	Barra de Gastos: Representada en color rojo. 
	Hover: Muestra un tooltip con el mes seleccionado y el total exacto de Ingresos (en texto verde) y Gastos (en texto rojo) de ese mes. 
	Criterio 2.2 (Gráfico de Línea - Saldo acumulado en el año):
	Representa la evolución del balance acumulado de forma cronológica mes a mes (Enero a Diciembre). 
	Hover: Al interactuar con el punto de un mes, muestra un tooltip con el Saldo Acumulado en valor numérico exacto a esa fecha. 
3. Tabla "Resumen por mes — {Año}"
	Criterio 3.1 Columnas dinámicas:
	La tabla debe generar columnas dinámicas de ingresos y gastos individuales según los usuarios activos vinculados al hogar (ej. ING. {NOMBRE_USUARIO_1}, ING. {NOMBRE_USUARIO_2}, GST. {NOMBRE_USUARIO_1}, GST. {NOMBRE_USUARIO_2}), además de las columnas consolidadas: TOTAL INGRESOS, COMPARTIDO, TOTAL GASTOS, BALANCE y AHORRO %. 
	Criterio 3.2 Meses sin registros o futuros:
	Celdas de meses sin información o futuros deben mostrar un carácter nulo/guión (-) sin romper el cálculo de promedios ni generar errores. 
Aspectos Técnicos Generales
	Inyección de Datos: Todas las opciones de usuarios e integrantes deben provenir de una consulta/endpoint de configuración de la cuenta del hogar (GET /api/v1/household/members), evitando cualquier valor escrito en duro en el código frontend (hardcoded).

