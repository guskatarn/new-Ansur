import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';

/**
 * Driver simulé : produit des mesures aléatoires plausibles.
 * Sert de base pour construire et tester le moteur de test avant que
 * les drivers réels (ESA620, Impulse, QA-ES, IDA-4...) ne soient prêts.
 */
export class MockInstrumentDriver implements InstrumentDriver {
  public readonly capabilities: InstrumentCapabilities;
  private connected = false;

  constructor(commandIds: readonly string[] = ['MOCK_VOLTAGE', 'MOCK_LEAKAGE']) {
    this.capabilities = {
      instrumentId: 'MOCK-INSTRUMENT',
      supportedCommandIds: commandIds,
    };
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendCommand(commandId: string): Promise<void> {
    if (!this.connected) {
      throw new Error(`Driver non connecté : impossible d'envoyer ${commandId}`);
    }
    if (!this.capabilities.supportedCommandIds.includes(commandId)) {
      throw new Error(`Commande non supportée par ${this.capabilities.instrumentId} : ${commandId}`);
    }
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    return {
      commandId,
      value: Math.round(Math.random() * 1000) / 10,
      unit: 'V',
      timestamp: new Date().toISOString(),
    };
  }
}
