Título: HU-02 Gestión de Ingresos (Versión Desktop)
📋 Resumen
Permite a los usuarios visualizar, filtrar y registrar los ingresos del hogar de forma detallada. La pantalla incluye gráficos de tendencia y una tabla paginada, facilitando la administración y el seguimiento de las entradas económicas.

👤 Narrativa
Como usuario del sistema de gestión de finanzas del hogar
Quiero registrar, visualizar y filtrar los ingresos para Ana y Carlos
Para tener un control claro y detallado de las entradas económicas del hogar y poder analizarlas fácilmente.
✅ Criterios de Aceptación (BDD)
Escenario 1: Visualización inicial de la pantalla de Ingresos

Dado que el usuario ha navegado a la pantalla "Ingresos"
Cuando la pantalla se carga por primera vez
Entonces
Se muestra el título "Ingresos" y el subtítulo "Registro de entradas del hogar". (Observado)
Se muestra un botón "+ Nuevo Ingreso" en la esquina superior derecha. (Observado)
Se muestran los filtros "Año", "Mes", "Día" y "Persona" con sus valores por defecto. (Observado)
El filtro "Año" muestra 2026 seleccionado por defecto. (Observado)
Los filtros "Mes", "Día" y "Persona" muestran "Todos" seleccionado por defecto. (Observado)
Se muestran los totales de ingresos para "Ana", "Carlos" y "Total" en la sección de filtros, con valores y colores correspondientes. (Observado)
Se muestra la gráfica "Ingresos por mes — 2026" con barras para Ana y Carlos. (Observado)
Se muestra la gráfica "Tendencia de ingresos totales" con una línea de área. (Observado)
Se muestra la sección "Detalle de ingresos" con el título "Detalle de ingresos" y el conteo de registros. (Observado)
La tabla de ingresos muestra las columnas "Fecha", "Persona", "Fuente", "Descripción", "Monto" y una columna de acciones vacía. (Observado)
La tabla se carga con los ingresos filtrados por el año 2026 y ordenados por fecha descendente. (Inferido)
Los datos mostrados en las gráficas y la tabla corresponden a los ingresos del año 2026. (Inferido)
Escenario 2: Filtrar ingresos por Año

Dado que la pantalla de Ingresos está visible con datos del año 2026
Cuando el usuario selecciona el año 2025 en el dropdown "Año"
Entonces
Las gráficas "Ingresos por mes" y "Tendencia de ingresos totales" se actualizan para mostrar los datos correspondientes al año 2025. (Inferido)
La tabla "Detalle de ingresos" se actualiza para mostrar solo los ingresos registrados en el año 2025. (Inferido)
Los totales de "Ana", "Carlos" y "Total" se actualizan para reflejar los ingresos del año 2025. (Inferido)
El título de la gráfica de barras se actualiza a "Ingresos por mes — 2025". (Inferido)
Escenario 3: Filtrar ingresos por Mes

Dado que la pantalla de Ingresos está visible con el filtro "Año" en 2026 y "Mes" en "Todos"
Cuando el usuario selecciona "Marzo" en el dropdown "Mes"
Entonces
La tabla "Detalle de ingresos" se actualiza para mostrar solo los ingresos registrados en Marzo de 2026. (Inferido)
Los totales de "Ana", "Carlos" y "Total" se actualizan para reflejar los ingresos de Marzo de 2026. (Inferido)
Las gráficas no se ven afectadas por el filtro de mes, ya que siempre muestran todos los meses del año seleccionado. (Observado de las gráficas que muestran todos los meses de Ene a Dic)
Escenario 4: Filtrar ingresos por Persona

Dado que la pantalla de Ingresos está visible con el filtro "Persona" en "Todos"
Cuando el usuario selecciona "Ana" en el dropdown "Persona"
Entonces
La tabla "Detalle de ingresos" se actualiza para mostrar solo los ingresos registrados para "Ana". (Inferido)
Los totales de "Ana", "Carlos" y "Total" se actualizan para reflejar solo los ingresos de "Ana" (el total de Carlos será cero, y el total general será igual al total de Ana). (Inferido)
Las gráficas se actualizan para mostrar solo los ingresos de "Ana" (la barra/línea de Carlos será cero o no visible). (Inferido)
Escenario 5: Abrir el modal "Nuevo Ingreso"

Dado que el usuario está en la pantalla de Ingresos
Cuando hace clic en el botón "+ Nuevo Ingreso"
Entonces
Se muestra un modal centrado en la pantalla con un fondo oscuro translúcido. (Observado)
El título del modal es "Nuevo Ingreso". (Observado)
El modal contiene los campos de formulario: "Fecha", "Persona", "Fuente", "Descripción" y "Monto (COP)". (Observado)
El campo "Fecha" muestra la fecha actual por defecto. (Inferido)
El campo "Persona" muestra "Ana" seleccionado por defecto. (Inferido)
El campo "Fuente" muestra "Salario" seleccionado por defecto. (Inferido)
El campo "Descripción" tiene el placeholder "Ej: Salario enero" y está vacío. (Observado)
El campo "Monto (COP)" tiene el placeholder "3500000" y está vacío. (Observado)
Se muestran los botones "Cancelar" y "Agregar ingreso" en la parte inferior del modal. (Observado)
Escenario 6: Cerrar el modal "Nuevo Ingreso"

Dado que el modal "Nuevo Ingreso" está abierto
Cuando el usuario hace clic en el botón "Cancelar"
Entonces
El modal se cierra y la pantalla de Ingresos vuelve a su estado anterior. (Inferido)
Cuando el usuario hace clic en el icono "X" en la esquina superior derecha del modal
Entonces
El modal se cierra y la pantalla de Ingresos vuelve a su estado anterior. (Inferido)
Cuando el usuario hace clic fuera del área del modal (en el fondo oscuro)
Entonces
El modal se cierra y la pantalla de Ingresos vuelve a su estado anterior. (Inferido)
Escenario 7: Agregar un nuevo ingreso exitosamente

Dado que el modal "Nuevo Ingreso" está abierto y todos los campos requeridos están llenos con datos válidos
Fecha: 2026-07-22
Persona: Ana
Fuente: Freelance
Descripción: Proyecto diseño / consultoría
Monto (COP): 358868
Cuando el usuario hace clic en el botón "Agregar ingreso"
Entonces
El modal se cierra. (Inferido)
El nuevo ingreso aparece en la tabla "Detalle de ingresos", respetando los filtros actuales. (Inferido)
Las gráficas y los totales se actualizan para incluir el nuevo ingreso. (Inferido)
El conteo de registros en la tabla se incrementa en uno. (Inferido)
Escenario 8: Abrir el modal "Editar Ingreso"

Dado que la tabla "Detalle de ingresos" contiene al menos un registro
Cuando el usuario hace clic en el icono de lápiz (editar) de un ingreso específico (ej. "Proyecto diseño / consultoría")
Entonces
Se muestra un modal centrado en la pantalla con un fondo oscuro translúcido. (Observado)
El título del modal es "Editar Ingreso". (Inferido)
Los campos del formulario ("Fecha", "Persona", "Fuente", "Descripción", "Monto (COP)") están precargados con los datos del ingreso seleccionado. (Inferido)
Los botones en la parte inferior del modal son "Cancelar" y "Guardar cambios". (Inferido)
Escenario 9: Guardar cambios de un ingreso exitosamente

Dado que el modal "Editar Ingreso" está abierto con los datos de un ingreso existente
Cuando el usuario modifica el campo "Monto (COP)" de 358868 a 400000
Y hace clic en el botón "Guardar cambios"
Entonces
El modal se cierra. (Inferido)
El ingreso en la tabla "Detalle de ingresos" se actualiza con el nuevo monto. (Inferido)
Las gráficas y los totales se actualizan para reflejar el cambio en el monto. (Inferido)
Escenario 10: Eliminar un ingreso

Dado que la tabla "Detalle de ingresos" contiene al menos un registro
Cuando el usuario hace clic en el icono de papelera (eliminar) de un ingreso específico
Entonces
Se muestra un cuadro de diálogo de confirmación (confirm). (Inferido)
Si el usuario confirma la eliminación:
El ingreso se elimina de la tabla "Detalle de ingresos". (Inferido)
Las gráficas y los totales se actualizan. (Inferido)
El conteo de registros en la tabla se decrementa en uno. (Inferido)
Si el usuario cancela la eliminación:
El cuadro de diálogo se cierra y el ingreso permanece en la tabla. (Inferido)
Escenario 11: Mostrar mensaje de tabla vacía

Dado que la pantalla de Ingresos está visible
Cuando no hay ingresos que coincidan con los filtros seleccionados
Entonces
La tabla "Detalle de ingresos" muestra un mensaje centrado que dice "No hay ingresos registrados para el período seleccionado.". (Observado)
Escenario 12: Validaciones de campos obligatorios en el modal de ingreso

Dado que el modal "Nuevo Ingreso" está abierto
Cuando el usuario intenta agregar un ingreso sin llenar el campo "Descripción"
Y hace clic en el botón "Agregar ingreso"
Entonces No se realiza ninguna acción y el modal permanece abierto, indicando que la descripción es obligatoria. (Inferido del código if (!form.description) return;)
Cuando el usuario intenta agregar un ingreso sin llenar el campo "Monto (COP)"
Y hace clic en el botón "Agregar ingreso"
Entonces No se realiza ninguna acción y el modal permanece abierto, indicando que el monto es obligatorio. (Inferido del código if (!form.amount) return;)
Escenario 13: Comportamiento Hover de elementos interactivos

Dado que la pantalla de Ingresos está visible
Cuando el usuario pasa el cursor sobre el botón "+ Nuevo Ingreso"
Entonces La opacidad del botón cambia, indicando interactividad (ej. hover:opacity-90). (Inferido del código hover:opacity-90 y del hover.png que muestra un patrón de brillo/opacidad para botones primarios).
Cuando el usuario pasa el cursor sobre los botones de acción de la tabla (lápiz o papelera)
Entonces El fondo del botón cambia (ej. lápiz hover:bg-secondary, papelera hover:bg-destructive/10). (Inferido del código y hover.png que muestra un patrón de cambio de fondo para iconos interactivos).
Cuando el usuario pasa el cursor sobre una fila de la tabla
Entonces El color de fondo de la fila cambia ligeramente (ej. hover:brightness-95). (Inferido del código).
Cuando el usuario pasa el cursor sobre las barras de la gráfica "Ingresos por mes"
Entonces Se muestra un tooltip con el mes, y los montos de Ana y Carlos en formato COP. (Observado hover.png y TooltipCustom component).
Cuando el usuario pasa el cursor sobre la línea de la gráfica "Tendencia de ingresos totales"
Entonces Se muestra un tooltip con el mes y el monto total en formato COP. (Inferido de TooltipCustom component).
Cuando el usuario pasa el cursor sobre los botones "Cancelar" o "Agregar/Guardar" en el modal
Entonces El botón "Cancelar" cambia su fondo (ej. hover:bg-muted), y el botón primario de acción cambia su opacidad (ej. hover:opacity-90). (Inferido del código).
⚙️ Notas Técnicas / Supuestos
Supuesto de Datos Dinámicos: Todos los datos mostrados en la interfaz (ingresos en la tabla, valores en gráficas, totales, opciones de filtros) se consideran dinámicos y provienen de una fuente de datos (backend).
Supuesto de Formato de Moneda: Los valores monetarios se formatean usando el estándar COP (Pesos Colombianos) con separadores de miles y decimales, según la función formatCOP presente en el código.
Supuesto de Formato de Fecha: Las fechas se muestran en un formato legible para el usuario (ej. "22 Jul 2026") utilizando la función formatDisplayDate.
Supuesto de Identificadores Únicos: Cada ingreso tiene un id único, generado por la función generateId() para nuevos ingresos.
Supuesto de Colores: Los colores específicos para "Ana" (#3B82F6), "Carlos" (#F59E0B), "Total" (#10B981) y las fuentes de ingreso (SOURCE_COLORS) están definidos como constantes en el código y deben ser utilizados para la consistencia visual.
Supuesto de Iconografía: Los iconos (Plus, Pencil, Trash2, X) son de la librería lucide-react y sus tamaños están especificados en el código.
Supuesto de Componentes Reutilizables:
Botones: Primario (ej. "Nuevo Ingreso", "Agregar ingreso"), Secundario (ej. "Cancelar"), Icono (ej. editar, eliminar, cerrar modal).
Dropdowns/Selects: Componente genérico para selección con etiqueta y opciones.
Inputs de Formulario: Componente genérico para entrada de texto, fecha, número con etiqueta y placeholder.
Tarjetas/Contenedores: Componente genérico para secciones de contenido con bordes redondeados y sombra (ej. filtros, gráficas, tabla).
Badges/Chips: Componente para mostrar la persona y la fuente con colores distintivos.
Gráficas: Los componentes BarChart, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer de recharts son utilizados. Se espera que el TooltipCustom sea un componente reutilizable para los tooltips de las gráficas.
Contenido de Dropdowns (Inferido del código):
Dropdown "Año": [2025, 2026].
Dropdown "Mes": ['Todos', 'Enero', 'Febrero', ..., 'Diciembre'].
Dropdown "Día": ['Todos', 1, 2, ..., 31].
Dropdown "Persona": ['Todos', 'Ana', 'Carlos'].
Dropdown "Fuente" (en modal): ['Salario', 'Freelance', 'Arriendo', 'Inversiones', 'Bono', 'Otros'].
Comportamiento del Input de Monto (Inferido): Aunque el type="number" se usa, el código limpia la entrada (replace(/[^0-9]/g, '')) antes de convertir a número, lo que sugiere una robustez para manejar entradas no numéricas, aunque la UI debería guiar al usuario a introducir solo números.
Validación de Formulario (Inferido): Los campos "Descripción" y "Monto" en el modal son obligatorios antes de guardar/agregar un ingreso. No se ha observado feedback visual de validación (ej. borde rojo, mensaje de error) en las imágenes, por lo que se asume un comportamiento de "no-acción" si los campos están vacíos. Pendiente de definición: ¿Cómo se comunica al usuario que un campo es obligatorio o que la entrada es inválida?
Alcance de la HU: Esta historia cubre exclusivamente la versión Desktop de la pantalla "Ingresos". La adaptación a dispositivos móviles (Responsive Design) se gestionará en una HU separada.
Estado de Focus: El estado focus no está documentado en hover.png ni es visible explícitamente. Se asume que los elementos interactivos deben tener un estado de focus estándar que cumpla con los requisitos de accesibilidad. Pendiente de definición: Definir estilos específicos para el estado focus si es necesario.
Estado de Activo/Seleccionado/Deshabilitado/Cargando/Vacío/Error (no validación): No se observan estados específicos para estos en los insumos más allá de los dropdowns y el mensaje de tabla vacía. Pendiente de definición: Si se requieren estados visuales específicos para estos escenarios.
UX/UI: La distribución general, la jerarquía visual, las alineaciones, tamaños aproximados, márgenes, padding, separación entre componentes, bordes, radios y sombras se derivan directamente de las imágenes y las clases CSS/estilos inline del código.
Integraciones: No se definen APIs, endpoints, contratos de servicios o estructuras de respuesta, ya que no están explícitamente documentados en el código proporcionado. Se asume que el equipo de backend definirá la interfaz de datos necesaria para interactuar con la fuente de ingresos.