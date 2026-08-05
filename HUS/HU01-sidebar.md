📝 Título: Implementar Componente de Sidebar para Navegación Principal
📋 Resumen
Implementar el componente de barra lateral (sidebar) para la navegación principal de la aplicación, replicando el diseño y comportamiento proporcionados. Esto incluye la estructura del encabezado, los elementos de navegación y la sección de indicadores de personas, con soporte para vistas de escritorio y móvil.

👤 Narrativa
Como usuario de la aplicación FinanzasHogar
Quiero poder navegar fácilmente entre las diferentes secciones principales
Para acceder rápidamente a la información y funcionalidades de gestión financiera.
✅ Criterios de Aceptación (BDD)
Escenario 1: Visualización del Sidebar en Escritorio

Dado que el usuario accede a la aplicación desde un dispositivo de escritorio (ancho de pantalla ≥ 768px)
Cuando la aplicación se carga
Entonces se muestra el sidebar de forma permanente en el lado izquierdo de la pantalla, ocupando un ancho de 240px (w-60).
Escenario 2: Estructura del Encabezado del Sidebar

Dado que el sidebar está visible
Cuando el usuario observa la sección superior
Entonces se visualiza un logo con el icono Home (tamaño 16px, color blanco) dentro de un círculo naranja (var(--accent) de 32x32px), seguido del texto "FinanzasHogar" (color var(--sidebar-primary), negrita, tamaño 0.95rem) y debajo "Control familiar · 2026" (color var(--sidebar-foreground), opacidad 0.55, tamaño 0.7rem).
Y esta sección tiene un padding horizontal de 24px (px-6), vertical de 20px (py-5) y un borde inferior (border-b) con color var(--sidebar-border).
Escenario 3: Visualización de los Elementos de Navegación

Dado que el sidebar está visible
Cuando el usuario observa la sección de navegación
Entonces se muestran los siguientes elementos de navegación en orden descendente, cada uno con su icono, etiqueta principal y descripción secundaria:
Gastos Diarios: Icono Receipt, "Registro de egresos".
Ingresos: Icono TrendingUp, "Registro de entradas".
Resumen Mensual: Icono BarChart2, "Balance por mes".
Por Categoría: Icono PieChart, "Análisis de categorías".
Proyección Deudas: Icono CreditCard, "Pagos y proyecciones".
Y cada elemento es un botón con padding horizontal de 12px (px-3), vertical de 10px (py-2.5), esquinas redondeadas (rounded-lg), y ocupa el 100% del ancho disponible.
Y los iconos tienen un tamaño de 18px.
Y las etiquetas principales tienen un tamaño de 0.85rem y las descripciones secundarias 0.68rem con una opacidad del 50%.
Escenario 4: Estado Activo de un Elemento de Navegación

Dado que el sidebar está visible y "Gastos Diarios" es el elemento activo (currentPage es 'gastos')
Cuando el usuario observa el elemento "Gastos Diarios"
Entonces su fondo es de color var(--sidebar-accent).
Y su texto es de color var(--sidebar-accent-foreground).
Y tiene un borde izquierdo de 3px de grosor y color var(--accent).
Y el icono tiene opacidad completa (100%).
Y la etiqueta principal "Gastos Diarios" está en negrita (fontWeight: 600).
Escenario 5: Estado Normal de un Elemento de Navegación

Dado que el sidebar está visible y "Ingresos" no es el elemento activo (currentPage no es 'ingresos')
Cuando el usuario observa el elemento "Ingresos"
Entonces su fondo es transparente.
Y su texto es de color var(--sidebar-foreground).
Y tiene un borde izquierdo de 3px transparente.
Y el icono tiene una opacidad del 65%.
Y la etiqueta principal "Ingresos" tiene un peso de fuente normal (fontWeight: 400).
Escenario 6: Navegación entre Elementos del Sidebar

Dado que el sidebar está visible y "Gastos Diarios" es el elemento activo
Cuando el usuario hace clic en el elemento "Ingresos"
Entonces el elemento "Gastos Diarios" cambia a su estado normal (fondo transparente, texto var(--sidebar-foreground), borde izquierdo transparente, icono opacidad 65%, texto normal).
Y el elemento "Ingresos" cambia a su estado activo (fondo var(--sidebar-accent), texto var(--sidebar-accent-foreground), borde izquierdo var(--accent), icono opacidad 100%, texto negrita).
Y se invoca la función onNavigate con el ID 'ingresos'.
Escenario 7: Visualización de la Sección de Personas

Dado que el sidebar está visible
Cuando el usuario observa la sección inferior
Entonces se muestra un encabezado "PERSONAS" (tamaño 0.68rem, mayúsculas, espaciado de letras 0.06em, opacidad 45%, margen inferior 0.5rem).
Y se muestran tres indicadores de personas:
Un círculo azul (#3B82F6) de 10x10px seguido del texto "Ana" (tamaño 0.75rem, opacidad 80%).
Un círculo naranja (#F59E0B) de 10x10px seguido del texto "Carlos" (tamaño 0.75rem, opacidad 80%).
Un círculo verde (#10B981) de 10x10px seguido del texto "Compartido" (tamaño 0.75rem, opacidad 80%).
Y esta sección tiene un padding horizontal de 16px (px-4), vertical de 16px (py-4) y un borde superior (border-t) con color var(--sidebar-border).
Escenario 8: Comportamiento del Sidebar en Móvil - Cerrado

Dado que el usuario accede a la aplicación desde un dispositivo móvil (ancho de pantalla < 768px)
Cuando la aplicación se carga
Entonces el sidebar no es visible inicialmente.
Y se muestra un botón de menú flotante en la esquina superior izquierda (3px desde el borde superior y 3px desde el borde izquierdo), con el icono Menu (tamaño 20px), fondo var(--sidebar) y color de icono var(--sidebar-foreground).
Escenario 9: Comportamiento del Sidebar en Móvil - Apertura

Dado que el sidebar está cerrado en la vista móvil
Cuando el usuario hace clic en el botón de menú flotante
Entonces el sidebar se desliza desde la izquierda, ocupando un ancho de 240px (w-60).
Y se muestra un botón de cierre con el icono X (tamaño 18px) en la esquina superior derecha del sidebar móvil (3px desde el borde superior, 3px desde el borde derecho), con fondo rgba(255,255,255,0.1) y color blanco.
Y el resto de la pantalla se cubre con un overlay semitransparente (bg-black/40).
Escenario 10: Comportamiento del Sidebar en Móvil - Cierre

Dado que el sidebar está abierto en la vista móvil
Cuando el usuario hace clic en el botón de cierre (X)
Entonces el sidebar se oculta (se desliza hacia la izquierda).
Y el overlay semitransparente desaparece.
Y el botón de menú flotante reaparece.
Escenario 11: Comportamiento del Sidebar en Móvil - Cierre al Navegar

Dado que el sidebar está abierto en la vista móvil
Cuando el usuario hace clic en un elemento de navegación (ej. "Ingresos")
Entonces el elemento de navegación seleccionado cambia a estado activo.
Y el sidebar se oculta.
Y el overlay semitransparente desaparece.
Y el botón de menú flotante reaparece.
Y se invoca la función onNavigate con el ID correspondiente.
Escenario 12: Comportamiento del Sidebar en Móvil - Cierre al hacer clic fuera

Dado que el sidebar está abierto en la vista móvil
Cuando el usuario hace clic en el overlay semitransparente
Entonces el sidebar se oculta.
Y el overlay semitransparente desaparece.
Y el botón de menú flotante reaparece.
⚙️ Notas Técnicas / Supuestos
Los textos "FinanzasHogar", "Control familiar · 2026", "Personas", "Ana", "Carlos", "Compartido" y los textos de los ítems de navegación (etiquetas y descripciones) deben ser datos estáticos (hardcodeados) en esta versión.
Los iconos provienen de la librería lucide-react (Home, Receipt, TrendingUp, BarChart2, PieChart, CreditCard, Menu, X).
El componente debe hacer uso de variables CSS para los colores principales como --sidebar, --sidebar-foreground, --sidebar-border, --sidebar-primary, --accent, --sidebar-accent, --sidebar-accent-foreground.
Se asume un comportamiento de hover para los elementos de navegación: al pasar el ratón por encima de un ítem no activo, el fondo del botón cambia ligeramente o el texto/icono se ilumina, pero no se activa el estado de selección completa (se infiere de transition-all en el código y buenas prácticas de UX). Este cambio de estilo exacto queda a discreción del equipo de desarrollo si no se especifica un diseño de hover.
La sección "Personas" es puramente visual en esta HU; no hay funcionalidad asociada a los nombres mostrados (ej. filtrado, selección, etc.).
La lógica de navegación (onNavigate) es una función que recibe el ID de la página y actualiza el estado currentPage. No se espera que este componente gestione el enrutamiento completo de la aplicación (ej. React Router) sino que emita un evento o prop.
El componente debe ser responsivo, mostrando la barra lateral fija en escritorio y un menú desplegable (drawer) en móvil, utilizando las clases de Tailwind CSS (md:flex, md:hidden, etc.) como referencia.
No se consideran escenarios de manejo de errores específicos para la visualización o interacción del sidebar, ya que el componente es principalmente de UI y navegación con datos estáticos. Se asume que los currentPage y onNavigate props siempre serán válidos.