HU-004: Módulo de Gestión y Proyección de Deudas
ID: HU-004
Título: Gestión, Amortización y Proyección de Saldo Fin de Deudas
Épica: Proyección Financiera
Historia de Usuario
Como usuario registrado de la aplicación web de finanzas del hogar, 
Quiero registrar mis préstamos o tarjetas de crédito, realizar abonos a capital, simular la proyección de amortización y asociar los pagos con mis gastos diarios, 
Para saber con exactitud la fecha estimada en la que finalizaré el pago de cada deuda y planificar la liberación de mi flujo de caja. 
Criterios de Aceptación Funcionales
1. Barra de Filtros y Resumen Superior
	Criterio 1.1: El usuario podrá filtrar la vista mediante los siguientes desplegables:
	Persona: Lista desplegable dinámica con los integrantes vinculados al hogar y la opción "Todos" (ejemplo visual: Ana, Carlos, Compartido). 
	Deuda/Préstamo: Lista desplegable dinámica para seleccionar un crédito específico o la opción "Todas las deudas". 
	Criterio 1.2: Los indicadores dinámicos del extremo superior derecho cambiarán según los filtros aplicados:
	DEUDA TOTAL: Suma consolidada del saldo pendiente de todos los créditos en formato de moneda (destacado en rojo/rosa). 
	CUOTA MES: Suma de los pagos obligatorios mensuales requeridos para cubrir las cuotas vigentes. 
	% PAGADO: Porcentaje global pagado calculado como ((Monto Original Total - Saldo Actual Total) / Monto Original Total) * 100. 
2. Lista Tarjetas de Crédito / Préstamos y Estado Vacío
	Criterio 2.1 (Estado Vacío - Zero State): Si el usuario o el filtro aplicado no registra deudas activas, la pantalla reemplazará los gráficos y la lista por un mensaje motivacional de estado vacío (ejemplo: "¡Felicitaciones! No tienes deudas en este momento.").
	Criterio 2.2 (Tarjetas de Deuda):
	Presenta un carrusel o cuadrícula dinámica con tantas tarjetas como créditos tenga registrados el usuario/hogar. 
	Cada tarjeta mostrará:
	Nombre de la deuda y badge del responsable (Compartido, Ana, Carlos, etc.). 
	Saldo actual y monto original en moneda local. 
	Meses restantes estimados para liquidar la deuda. 
	Fecha proyectada de finalización (Mes/Año, ej.: Enero 2039, Agosto 2029). 
	Porcentaje del crédito amortizado y barra visual de progreso. 
	Botón Acción Directa: Botón + Pago a Capital habilitado en cada tarjeta. 
3. Botones de Acción y Ventanas Modales
	Criterio 3.1 Modal "Nueva Deuda":
	Se activa mediante el botón superior "+ Nueva Deuda". 
	Campos del Formulario:
	Persona: Selector desplegable con integrantes del hogar y "Compartido". 
	Fecha inicio: Selector de fecha (precarga por defecto la fecha actual DD/MM/AAAA). 
	Nombre de la deuda: Campo de texto libre con placeholder (ej.: Ej: Hipoteca, Tarjeta crédito...). 
	Monto original (COP): Campo numérico en pesos. 
	Saldo actual (COP): Campo numérico en pesos (permite inicializar si ya se venía pagando). 
	Cuota mensual (COP): Valor del pago mínimo o cuota mensual fijada. 
	Tasa anual (%): Porcentaje de interés efectivo anual (ej.: 10.2). 
	Acciones: Cancelar / Agregar deuda (valida campos requeridos, guarda el crédito, recalcula las proyecciones y actualiza la UI). 
	Criterio 3.2 Modal "Pago Adicional a Capital":
	Se activa desde el botón "+ Pago a Capital" (superior o de tarjeta). 
	Campos del Formulario:
	Deuda a abonar: Selector desplegable para elegir el crédito (al seleccionar, muestra dinámicamente el Saldo actual: $ XXX). 
	Monto del abono (COP): Campo numérico. 
	Fecha del pago: Selector de fecha. 
	Acciones: Cancelar / Aplicar abono. 
	Integración con Gastos Diarios (Regla Clave): Al confirmar un abono o pago de cuota, el sistema descontará directamente el valor del saldo de capital de la deuda, recalculará la tabla de amortización y registrará automáticamente la transacción como un egreso en la pantalla de "Gastos Diarios" con la categoría Deudas/Préstamos o la categoría asignada al crédito. 
4. Dashboard Gráfico de Proyección
	Criterio 4.1 (Gráfico de Líneas - Proyección de Saldos - Próximos 36 Meses):
	Muestra la curva proyectada de amortización descendente del saldo de cada deuda a lo largo de los próximos 36 meses. 
	Cada línea adopta un color distintivo asociado a la deuda (ej.: Azul - Hipoteca, Naranja - Crédito Vehículo, Rojo - Tarjeta de Crédito, Verde - Préstamo Personal). 
	Comportamiento Hover: Al mover el cursor por la línea del tiempo (eje X), dibuja un eje vertical y muestra un tooltip con el mes/año (ej.: Feb 27) y la lista de todos los saldos restantes proyectados para cada crédito a esa fecha. 
	Criterio 4.2 (Gráfico de Barras Horizontales - Cuotas Mensuales):
	Visualiza en el eje Y los nombres de las deudas activas y en barras horizontales la cuota fija asignada a cada una. 
	Comportamiento Hover: Al situarse sobre la barra, resalta con fondo gris y muestra un tooltip con el monto formateado (ej.: Cuota mensual : $ 700.000). 
5. Tabla "Detalle de Deudas"
	Criterio 5.1 Estructura y Columnas: Muestra la lista consolidada de créditos con las siguientes columnas: 
	DEUDA: Nombre otorgado al crédito. 
	PERSONA: Badge asociativo del responsable (Compartido, Ana, Carlos, etc.). 
	SALDO ACTUAL: Monto pendiente por amortizar resaltado en rojo/rosa. 
	MONTO ORIGINAL: Valor inicial desembolsado. 
	CUOTA/MES: Pago exigido mensualmente. 
	TASA ANUAL: Porcentaje E.A. del crédito destacado en verde/naranja/rojo según el nivel de tasa. 
	MESES RESTANTES: Número de meses calculados para llegar a $0 según las cuotas y abonos realizados. 
	FIN PROYECTADO: Mes y Año proyectado de liquidación total (ej.: Enero 2039, Abril 2027). 
	ACCIONES: Ícono de Lápiz (Editar deuda) e Ícono de Papelera (Eliminar crédito). 
	Criterio 5.2 Recuento: Muestra en la esquina superior de la tabla la cantidad de registros (ej.: 4 registros). 
Aspectos Técnicos y Algoritmo de Amortización
	Fórmula de Amortización Francesa (Proyección Cuotas y Abonos):
	Por cada periodo mensual k, el interés devengado es:
I_k=〖"Saldo" 〗_(k-1)×("Tasa Anual" /(12×100))
	El abono a capital obligatorio de la cuota fija C es:
A_k=C-I_k
	Ante un Abono Adicional a Capital (A_extra), el saldo se reduce de inmediato:
〖"Saldo" 〗_k=〖"Saldo" 〗_(k-1)-A_k-A_extra
	El cálculo recalcula la serie en tiempo real hasta que 〖"Saldo" 〗_k≤0, determinando dinámicamente los Meses Restantes y la fecha de Fin Proyectado. 
	Integración Backend / Sincronización:
	POST /api/v1/debts: Crear nueva deuda. 
	POST /api/v1/debts/{id}/prepayments: Registrar abono a capital. Esta transacción debe ejecutar un trigger o evento de dominio que:
	Actualice el saldo de la deuda. 
	Inserte un registro en la tabla/colección de Expenses (Gastos Diarios) vinculando el debt_id para garantizar la trazabilidad del egreso. 
	Optimización de UI/UX:
	Al filtrar por una persona en la barra superior, tanto los indicadores, tarjetas de crédito, gráficos de proyección (36 meses) y la tabla de detalle deben re-renderizarse de forma inmediata considerando únicamente los créditos asociados al usuario filtrado o a la etiqueta "Compartido".

