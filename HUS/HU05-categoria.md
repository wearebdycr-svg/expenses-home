HU-005: Módulo de Análisis de Gastos por Categoría
ID: HU-005
Título: Análisis de Distribución de Gastos por Categoría e Integrantes
Épica: Análisis Financiero y Balance
Historia de Usuario
Como usuario registrado de la aplicación web de finanzas del hogar, 
Quiero visualizar la distribución porcentual y en dinero de los gastos desglosados por categoría e integrante del hogar, 
Para identificar los rubros con mayor consumo financiero, analizar el comportamiento de gasto por persona y optimizar el presupuesto familiar. 
Criterios de Aceptación Funcionales
1. Barra de Filtros y Resumen Superior
	Criterio 1.1: El usuario podrá filtrar la pantalla mediante los siguientes desplegables superiores: 
	Año: Lista desplegable de años con registros. 
	Mes: Lista de los 12 meses o la opción "Todos". 
	Día: Días del mes o la opción "Todos". 
	Persona: Lista desplegable dinámica de integrantes registrados en la cuenta del hogar más la opción "Todos" (ejemplo visual: Ana, Carlos, Compartido). 
	Criterio 1.2: Los indicadores dinámicos del extremo superior derecho indicarán: 
	TOTAL PERÍODO: Suma acumulada de egresos según el filtro en formato de moneda (destacado en rojo/marrón, ej. visual: $ 27.560.035). 
	CATEGORÍAS: Cantidad de categorías que tienen al menos una transacción registrada en el período filtrado (ej. visual: 11). 
2. Dashboard Gráfico de Categorías
	Criterio 2.1 (Gráfico Donut - Distribución Porcentual):
	Muestra la proporción porcentual del gasto total agrupado por categoría para el período filtrado. 
	Presenta debajo una leyenda interactiva con las principales categorías, mostrando su color asociativo, porcentaje y valor en dinero (ej. visual: Hogar 45.7% $ 12.600.000). 
	Comportamiento Hover: Al pasar el cursor sobre un segmento de la dona, despliega un tooltip centrado que muestra: 
	Nombre de la categoría (ej.: Alimentación). 
	Monto total consumido en la categoría formateado en verde (ej.: $ 4.297.864). 
	Porcentaje de participación respecto al gasto total (ej.: 15.6% del total). 
	Criterio 2.2 (Gráfico de Barras Horizontales Apiladas - Monto por Categoría y Persona):
	Disposición de Categorías (Eje Y): Debe mostrar a la izquierda la lista completa de todas las categorías con registros alineadas en el eje vertical. 
	Cada fila de categoría presenta una barra horizontal dividida por segmentos de color correspondientes al monto consumido por cada integrante registrado del hogar y la opción Compartido. 
	Comportamiento Hover: Al pasar el cursor sobre la barra o fila de una categoría, se resalta toda la barra con un fondo gris claro y despliega un tooltip flotante con: 
	Nombre de la categoría (ej.: Restaurantes). 
	El desglose individual consumido por cada integrante del hogar (ej. visual: Ana $913.252, Carlos$ 851.431) y la opción Compartido (ej.: Compartido $ 0). 
3. Tabla "Detalle por categoría"
	Criterio 3.1 Estructura y Columnas Dinámicas:
	Muestra la lista de todas las categorías activas ordenada en función del porcentaje o monto de mayor a menor. 
	Columnas:
	CATEGORÍA: Nombre con su respectivo punto de color asociativo. 
	Columnas de Integrantes: Generadas dinámicamente según los usuarios vinculados al hogar (ej. visual: ANA, CARLOS). 
	COMPARTIDO: Monto de gastos calificados como compartidos. 
	TOTAL: Suma total de la categoría (Monto Integrante 1 + ... + Compartido) resaltado en color rojo/rosado. 
	% DEL TOTAL: Barra de progreso visual y porcentaje que representa del gasto global del período. 
	TRANSACCIONES: Número de registros individuales asociados a dicha categoría. 
	Criterio 3.2 Formato de Celdas Sin Registro:
	Si un integrante no registra gasto en determinada categoría, la celda correspondiente debe presentar un guión nulo (-) alineado al centro sin generar celdas vacías o errores. 
Aspectos Técnicos y Reglas de Negocio
	Agrupación y Ordenamiento:
	Las categorías en la tabla y en el gráfico horizontal deben ordenarse en forma descendente (DESC) por el monto TOTAL acumulado. 
	Cálculo de Porcentajes:
%" del Total Por Categoría"=("Total Gastos Categoría" /"Total Período" )×100
	Inyección Dinámica de Usuarios y Categorías:
	Las columnas de la tabla y los segmentos de las barras apiladas deben mapearse iterando el array de usuarios obtenido de la cuenta familiar/hogar (GET /api/v1/household/members), permitiendo escalar el sistema si la familia tiene más o menos integrantes sin modificar la estructura del frontend. 
	Librería Gráfica:
	Configurar el gráfico horizontal con un eje X escalado en notación de miles/millones ($0k, $3500k, $7000k, etc.) y habilitar la opción de visualización completa de etiquetas en el eje Y para evitar recortes en nombres largos de categorías (ej. Entretenimiento..., Cuidado Personal...). 

