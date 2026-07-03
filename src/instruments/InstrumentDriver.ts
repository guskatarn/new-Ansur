/**
 * Contrat que doit respecter tout driver d'instrument (réel ou simulé).
 * Chaque instrument = un driver isolé, parlant son propre protocole,
 * sans fuite de détails de communication (série/USB) vers le moteur de test.
 */

/** Déclare ce qu'un driver sait faire, pour validation à la construction du template. */
export interface InstrumentCapabilities {
  readonly instrumentId: string; // ex. "ESA620", "IMPULSE-6000D"
  readonly supportedCommandIds: readonly string[];
}

export interface MeasurementResult {
  readonly commandId: string;
  readonly value: number | boolean | string;
  readonly unit?: string;
  readonly timestamp: string; // ISO 8601
}

export interface InstrumentDriver {
  readonly capabilities: InstrumentCapabilities;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Envoie une commande brute au format propre au protocole de l'instrument. */
  sendCommand(commandId: string, params?: Record<string, string | number>): Promise<void>;

  /** Lit une mesure suite à l'exécution d'une commande. */
  readMeasurement(commandId: string): Promise<MeasurementResult>;
}
