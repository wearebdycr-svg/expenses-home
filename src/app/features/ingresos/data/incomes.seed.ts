import type { Income } from './income.model';

/**
 * Datos semilla en memoria. El servicio expone la misma forma que tendría
 * una respuesta de API real, para que reemplazar esta fuente por HttpClient
 * más adelante no requiera cambios en los componentes.
 */
export const INCOME_SEED: readonly Income[] = [
  // Enero 2026
  { id: 'inc-001', date: '2026-01-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-002', date: '2026-01-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-003', date: '2026-01-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_300_000 },
  { id: 'inc-004', date: '2026-01-28', person: 'Ana', source: 'Inversiones', description: 'Dividendos fondo', amount: 210_000 },

  // Febrero 2026
  { id: 'inc-005', date: '2026-02-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-006', date: '2026-02-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-007', date: '2026-02-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_300_000 },
  { id: 'inc-008', date: '2026-02-18', person: 'Ana', source: 'Otros', description: 'Reembolso gastos', amount: 180_000 },

  // Marzo 2026
  { id: 'inc-009', date: '2026-03-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-010', date: '2026-03-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-011', date: '2026-03-15', person: 'Ana', source: 'Freelance', description: 'Proyecto diseño', amount: 733_133 },
  { id: 'inc-012', date: '2026-03-20', person: 'Carlos', source: 'Salario', description: 'Salario mensual + bono', amount: 5_050_000 },

  // Abril 2026
  { id: 'inc-013', date: '2026-04-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-014', date: '2026-04-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-015', date: '2026-04-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_400_000 },
  { id: 'inc-016', date: '2026-04-12', person: 'Carlos', source: 'Bono', description: 'Bono desempeño', amount: 500_000 },

  // Mayo 2026
  { id: 'inc-017', date: '2026-05-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-018', date: '2026-05-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-019', date: '2026-05-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_600_000 },
  { id: 'inc-020', date: '2026-05-25', person: 'Ana', source: 'Freelance', description: 'Diseño logo cliente', amount: 620_000 },

  // Junio 2026
  { id: 'inc-021', date: '2026-06-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-022', date: '2026-06-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-023', date: '2026-06-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-024', date: '2026-06-14', person: 'Carlos', source: 'Otros', description: 'Venta artículo usado', amount: 150_000 },

  // Julio 2026
  { id: 'inc-025', date: '2026-07-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_500_000 },
  { id: 'inc-026', date: '2026-07-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 700_000 },
  { id: 'inc-027', date: '2026-07-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_300_000 },
  { id: 'inc-028', date: '2026-07-22', person: 'Ana', source: 'Freelance', description: 'Proyecto diseño / consultoría', amount: 358_668 },

  // Noviembre y diciembre 2025
  { id: 'inc-029', date: '2025-11-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_200_000 },
  { id: 'inc-030', date: '2025-11-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 650_000 },
  { id: 'inc-031', date: '2025-11-10', person: 'Carlos', source: 'Salario', description: 'Salario mensual', amount: 3_000_000 },
  { id: 'inc-032', date: '2025-12-01', person: 'Ana', source: 'Salario', description: 'Salario mensual', amount: 3_200_000 },
  { id: 'inc-033', date: '2025-12-05', person: 'Carlos', source: 'Arriendo', description: 'Arriendo apartamento', amount: 650_000 },
  { id: 'inc-034', date: '2025-12-24', person: 'Carlos', source: 'Bono', description: 'Bono navidad', amount: 800_000 },
];
