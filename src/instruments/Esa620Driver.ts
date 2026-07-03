import { SerialPort } from 'serialport';
import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

/**
 * Identifiants de commande ESA620 supportés, au format "ESA620:{TestID}".
 * Dérivés des fichiers .mtt ANSUR — à compléter au fur et à mesure que d'autres
 * templates sont importés. La liste exhaustive sera finalisée lors de l'implémentation
 * du protocole (Phase 4b, "ESA620 User Communication Interface v1.0").
 */
const ESA620_SUPPORTED_COMMANDS = [
  'ESA620:210',  // Tension secteur — Ligne / Neutre
  'ESA620:220',  // Tension secteur — Neutre / Terre
  'ESA620:230',  // Tension secteur — Ligne / Terre
  'ESA620:910',  // Fuite partie appliquée alternative — Condition normale
  'ESA620:1010', // Résistance d'isolement — Secteur / Terre de protection
  'ESA620:1020', // Résistance d'isolement — Parties appliquées / Terre
  'ESA620:1230', // Courant de fuite boîtier — Terre ouverte
  'ESA620:1260', // Courant de fuite boîtier — Terre ouverte, secteur inversé
  'ESA620:1310', // Courant de fuite patient — Condition normale
  'ESA620:1340', // Courant de fuite patient — Condition normale, secteur inversé
  'ESA620:1410', // Secteur sur parties appliquées — Défaut simple
  'ESA620:1420', // Secteur sur parties appliquées — Défaut simple, secteur inversé
  'ESA620:1610', // Fuite équipement alternative — Terre fermée
  'ESA620:1620', // Fuite équipement alternative — Terre ouverte
] as const satisfies readonly string[];

/**
 * Driver pour l'analyseur de sécurité électrique ESA620 (Fluke Biomedical).
 * Communique via le port COM virtuel créé par le driver USB Fluke.
 *
 * Phase 4a : structure complète, connexion/déconnexion opérationnelles,
 *            gestion des erreurs typées.
 * Phase 4b : implémentation des commandes de mesure selon
 *            "ESA620 User Communication Interface v1.0".
 */
export class Esa620Driver implements InstrumentDriver {
  readonly capabilities: InstrumentCapabilities = {
    instrumentId: 'ESA620',
    supportedCommandIds: [...ESA620_SUPPORTED_COMMANDS],
  };

  private serialPort: SerialPort | null = null;

  /**
   * @param portPath Chemin du port COM (ex. "COM3" sous Windows).
   *   Sélectionné manuellement par l'utilisateur dans les préférences.
   */
  constructor(public readonly portPath: string) {}

  async connect(): Promise<void> {
    if (this.serialPort?.isOpen) return;

    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort({
        path: this.portPath,
        // Baud rate à confirmer avec "ESA620 User Communication Interface v1.0"
        baudRate: 9600,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          reject(new InstrumentNotAvailableError('ESA620', this.portPath, err.message));
        } else {
          this.serialPort = port;
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    const port = this.serialPort;
    if (!port?.isOpen) {
      this.serialPort = null;
      return;
    }
    return new Promise<void>((resolve) => {
      port.close(() => {
        this.serialPort = null;
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.serialPort?.isOpen ?? false;
  }

  async sendCommand(commandId: string): Promise<void> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('ESA620');
    // TODO Phase 4b : implémenter selon "ESA620 User Communication Interface v1.0"
    throw new Error(`ESA620 sendCommand("${commandId}") : protocole non encore implémenté.`);
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('ESA620');
    // TODO Phase 4b : implémenter selon "ESA620 User Communication Interface v1.0"
    throw new Error(`ESA620 readMeasurement("${commandId}") : protocole non encore implémenté.`);
  }
}
