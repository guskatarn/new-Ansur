import type { InstrumentDriver } from '../instruments/InstrumentDriver.js';
import type {
  ElementResult,
  ElementResultStatus,
  Limit,
  TestElement,
  TestRecord,
  TestSequence,
  TestTemplate,
} from './types.js';

/**
 * Moteur de test : exécute un TestTemplate (via une TestSequence) en pilotant
 * un InstrumentDriver, applique les limites, et produit un TestRecord.
 *
 * Volontairement indépendant de l'UI et du matériel réel (dépend seulement
 * de l'interface InstrumentDriver) : testable unitairement avec un mock.
 */
export class TestEngine {
  constructor(private readonly driver: InstrumentDriver) {}

  /**
   * Valide qu'un template est exécutable avec le driver courant :
   * chaque test element référençant une commande instrument doit être
   * supporté par les capabilities du driver.
   */
  validateTemplateCompatibility(template: TestTemplate): string[] {
    const errors: string[] = [];
    for (const element of template.elements) {
      if (
        element.instrumentCommandId &&
        !this.driver.capabilities.supportedCommandIds.includes(element.instrumentCommandId)
      ) {
        errors.push(
          `Élément "${element.label}" (${element.id}) requiert la commande ` +
            `"${element.instrumentCommandId}", non supportée par ${this.driver.capabilities.instrumentId}.`,
        );
      }
    }
    return errors;
  }

  async execute(template: TestTemplate, sequence: TestSequence, executedBy: string): Promise<TestRecord> {
    const compatibilityErrors = this.validateTemplateCompatibility(template);
    if (compatibilityErrors.length > 0) {
      throw new Error(`Template incompatible avec le driver connecté :\n${compatibilityErrors.join('\n')}`);
    }

    if (!this.driver.isConnected()) {
      await this.driver.connect();
    }

    const results: ElementResult[] = [];
    for (const element of template.elements) {
      results.push(await this.executeElement(element));
    }

    const overallStatus = TestEngine.computeOverallStatus(results);

    return {
      id: crypto.randomUUID(),
      sequenceId: sequence.id,
      executedAt: new Date().toISOString(),
      executedBy,
      results,
      overallStatus,
    };
  }

  private async executeElement(element: TestElement): Promise<ElementResult> {
    if (!element.instrumentCommandId) {
      // Étape manuelle : pas de mesure automatique, statut à définir ailleurs (UI)
      return { elementId: element.id, status: 'skipped' };
    }

    await this.driver.sendCommand(element.instrumentCommandId);
    const measurement = await this.driver.readMeasurement(element.instrumentCommandId);

    const status = element.limit
      ? TestEngine.evaluateLimit(element.limit, measurement.value)
      : 'not-applicable';

    const measuredValue = typeof measurement.value === 'string' ? undefined : measurement.value;

    return measuredValue === undefined
      ? { elementId: element.id, status }
      : { elementId: element.id, status, measuredValue };
  }

  static evaluateLimit(limit: Limit, value: number | boolean | string): ElementResultStatus {
    if (limit.kind === 'numeric' && typeof value === 'number') {
      const aboveMin = limit.min === undefined || value >= limit.min;
      const belowMax = limit.max === undefined || value <= limit.max;
      return aboveMin && belowMax ? 'pass' : 'fail';
    }
    if (limit.kind === 'boolean' && typeof value === 'boolean') {
      return value === limit.expected ? 'pass' : 'fail';
    }
    return 'not-applicable';
  }

  static computeOverallStatus(results: readonly ElementResult[]): ElementResultStatus {
    if (results.some((r) => r.status === 'fail')) return 'fail';
    if (results.every((r) => r.status === 'skipped' || r.status === 'not-applicable')) return 'not-applicable';
    return 'pass';
  }
}
