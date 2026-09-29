Historia de Usuario: Módulo de Gastos Diarios y Registro de Egresos
ID: HU-003
Título: Visualización, Registro y Monitoreo de Gastos Diarios del Hogar
Épica: Gestión de Egresos
Historia de Usuario
Como usuario registrado de la plataforma FinanzasHogar, 
Quiero visualizar el resumen gráfico y detallado de mis egresos, filtrar por periodo/persona y registrar nuevos gastos, 
Para llevar un control diario eficiente, transparente y centralizado del presupuesto familiar. 
Criterios de Aceptación Funcionales
1. Barra de Filtros y Resumen Superior
•	Criterio 1.1: El usuario podrá filtrar la vista por Año, Mes, Día y Persona (lista desplegable con los usuarios registrados, ej.: Ana, Carlos, Compartido). 
•	Criterio 1.2: Los indicadores superiores indicarán en tiempo real:
o	Total Período: Suma consolidada en pesos (COP) según los filtros aplicados (ej.: $ 3.611.035). 
o	Transacciones: Cantidad total de registros que cumplen los filtros (ej.: 25). 
2. Visualización Gráfica (Dashboard Interactivo)
•	Criterio 2.1 (Gráfico de Barras - Gastos por día):
o	Muestra el histórico de gastos por día del mes seleccionado. 
o	Presenta barras apiladas o codificadas por color por cada persona/entidad (Ana, Carlos, Compartido). 
o	Comportamiento Hover: Al pasar el cursor sobre un día específico, se desplegará una tarjeta flotante (tooltip) con el desglose del gasto de cada persona (Ana, Carlos, Compartido) y el total acumulado de ese día. 
•	Criterio 2.2 (Gráfico Donut - Gastos por categoría):
o	Muestra la distribución porcentual de los gastos por categoría en el mes. 
o	Incluye la leyenda con las categorías principales y sus porcentajes (ej.: Hogar 49.8%, Alimentación 16.3%, etc.). 
o	Comportamiento Hover: Al interactuar/pasar el cursor sobre un segmento del gráfico de dona, mostrará un tooltip con el nombre de la categoría y la suma total acumulada para el mes filtrado (ej.: Hogar : $ 1.800.000). 
3. Modal "Nuevo Gasto"
•	Criterio 3.1: Se activa al pulsar el botón "+ Nuevo Gasto" ubicado en la esquina superior derecha. 
•	Criterio 3.2 Campos del formulario:
o	Fecha: Selector de fecha con ícono de calendario. Por defecto debe precargar la fecha actual en formato DD/MM/AAAA. 
o	Persona: Lista desplegable selector con los integrantes del hogar y la opción Compartido (ej.: Ana, Carlos, Compartido). 
o	Categoría: Selector desplegable con categorías predefinidas (Alimentación, Transporte, Salud, Entretenimiento, Educación, Ropa, Tecnología, Restaurantes, Cuidado Personal, Hogar, Servicios, Otros). 
o	Descripción: Campo de texto libre con placeholder explícito (ej.: Ej: Supermercado Éxito). 
o	Monto (COP): Campo numérico con formato de moneda. 
•	Criterio 3.3 Acciones:
o	Cancelar / Cerrar (X): Descarta los cambios y cierra el modal sin guardar. 
o	Agregar gasto: Valida la información, registra el nuevo gasto en la base de datos, refresca automáticamente el gráfico y la tabla, y cierra el modal. 
4. Tabla Detalle de Gastos
•	Criterio 4.1: Muestra el listado de transacciones con los siguientes campos correspondientes al formulario de ingreso: 
o	FECHA: Día, mes abreviado y año (ej.: 28 Jul 2026). 
o	PERSONA: Badge de color según el responsable (Verde: Compartido, Azul: Ana, Naranja: Carlos). 
o	CATEGORÍA: Nombre de la categoría asociada. 
o	DESCRIPCIÓN: Texto del concepto del gasto. 
o	MONTO: Valor numérico resaltado en formato de moneda. 
•	Criterio 4.2 Acciones por fila:
o	Editar (Ícono de Lápiz): Abre el modal con la información precargada para edición. 
o	Eliminar (Ícono de Papelera): Permite eliminar el registro solicitando confirmación previa. 
•	Criterio 4.3: Muestra en la parte superior derecha de la tabla el recuento total de registros visualizados. 
Aspectos Técnicos y Reglas de Negocio
1.	Validaciones de Formulario:
o	Campos Requeridos: Fecha, Persona, Categoría, Descripción y Monto son obligatorios.
o	Monto: Debe aceptar únicamente valores enteros positivos mayores a cero (> 0).
o	Descripción: Límite máximo de 100 caracteres.
2.	Desempeño y Estado:
o	La lista de categorías y personas debe ser consumida de un catálogo centralizado para mantener consistencia dinámica en caso de agregar un nuevo usuario al hogar. 
o	Al agregar un gasto, la vista debe actualizar la data mediante mutación optimista o re-fetch de datos sin recargar la página completa (SPA).
