import { SerialPort } from 'serialport';
import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

/**
 * Commandes Impulse 6000D/7000DP supportées.
 *
 * Implémentation selon le manuel officiel Fluke "Impulse 6000D/7000DP
 * Communications Interface v2.4" : 115200 bauds, 8N1, contrôle de flux
 * matériel recommandé par le manuel.
 *
 * Comme pour QaesDriver, cet identifiant ne suit pas la convention
 * "PluginName:TestID" tirée d'un .mtt réel (aucun exemple de fichier .mtt
 * Impulse n'était disponible). À revoir si un .mtt réel devient disponible.
 *
 * Seule la mesure d'impulsion de défibrillation (DEFIB + DREADY) est
 * implémentée : c'est la fonction principale de l'Impulse et la mieux
 * spécifiée par le manuel. Les fonctions pacemaker (PAPULSE/PASENSE/
 * PAREFRACT, réservées à l'Impulse 7000DP) et simulation ECG ne sont pas
 * implémentées dans cette phase.
 */
const IMPULSE_SUPPORTED_COMMANDS = ['IMPULSE:DEFIB_PULSE'] as const satisfies readonly string[];

/**
 * Nombre de champs numériques attendus après le type d'impulsion, selon le
 * manuel (section "DREADY"). Sert uniquement à valider grossièrement la
 * réponse ; les champs eux-mêmes ne sont pas décomposés (voir readMeasurement).
 */
const EXPECTED_FIELD_COUNT_BY_PULSE_TYPE: Readonly<Record<string, number>> = {
  '1': 8, // Monophasique : Énergie, Vpic, Ipic, Largeur 50%, Largeur 10%, Sync, ECG, Temps de charge
  '2': 14, // Biphasique : deux phases + délai inter-phase + tilt + sync + ECG + temps de charge
  '3': 0, // Biphasique pulsé : structure non extraite de l'extrait de manuel lu (à compléter)
};

/**
 * Driver pour le simulateur/analyseur de défibrillateur Impulse 6000D /
 * 7000DP (Fluke Biomedical). Communique via le port COM virtuel USB (FTDI).
 *
 * Phase 4a : connexion/déconnexion, passage en mode Remote (MAIN).
 * Phase 4b : mesure d'impulsion de défibrillation (DEFIB + DREADY). La
 *            commande DREADY a un comportement en deux temps documenté par
 *            le manuel : un accusé de réception "*" immédiat (l'instrument
 *            est armé), suivi — à un moment indéterminé, quand le DUT
 *            délivre effectivement un choc — d'une seconde ligne contenant
 *            les données de l'impulsion. readMeasurement() attend cette
 *            seconde ligne avec un délai généreux (l'opérateur doit
 *            déclencher le défibrillateur testé manuellement).
 */
export class ImpulseDriver implements InstrumentDriver {
  readonly capabilities: InstrumentCapabilities = {
    instrumentId: 'IMPULSE',
    supportedCommandIds: [...IMPULSE_SUPPORTED_COMMANDS],
  };

  private serialPort: SerialPort | null = null;

  /** @param portPath Chemin du port COM (ex. "COM7" sous Windows). */
  constructor(public readonly portPath: string) {}

  async connect(): Promise<void> {
    if (this.serialPort?.isOpen) return;

    const port = await new Promise<SerialPort>((resolve, reject) => {
      const p = new SerialPort({
        path: this.portPath,
        baudRate: 115_200, // Confirmé par "Impulse 6000D/7000DP Communications Interface v2.4"
        rtscts: true, // Contrôle de flux matériel recommandé par le manuel
        autoOpen: false,
      });

      p.open((err) => {
        if (err) {
          reject(new InstrumentNotAvailableError('IMPULSE', this.portPath, err.message));
        } else {
          resolve(p);
        }
      });
    });

    this.serialPort = port;
    await this.transmit('REMOTE', ImpulseDriver.ARM_TIMEOUT_MS);
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
    if (!this.isConnected()) throw new InstrumentNotConnectedError('IMPULSE');
    if (commandId !== 'IMPULSE:DEFIB_PULSE') {
      throw new Error(`IMPULSE sendCommand("${commandId}") : aucune correspondance de commande connue.`);
    }

    await this.transmit('MODE=DEFIB', ImpulseDriver.ARM_TIMEOUT_MS);
    const ack = await this.transmit('DREADY', ImpulseDriver.ARM_TIMEOUT_MS);
    if (ack !== '*') {
      throw new Error(`IMPULSE : échec de l'armement de la mesure d'impulsion (réponse "${ack}").`);
    }
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('IMPULSE');
    if (commandId !== 'IMPULSE:DEFIB_PULSE') {
      throw new Error(`IMPULSE readMeasurement("${commandId}") : aucune correspondance de commande connue.`);
    }

    // La ligne de données arrive de façon asynchrone, quand le DUT délivre
    // effectivement un choc — pas en réponse directe à une commande.
    const response = await this.readLine(ImpulseDriver.DEFIB_PULSE_TIMEOUT_MS);
    if (response === '') {
      throw new Error(
        "IMPULSE : aucune impulsion de défibrillation détectée dans le délai imparti (le DUT a-t-il délivré un choc ?).",
      );
    }

    const pulseType = response.split(',')[0];
    const expectedFields = pulseType !== undefined ? EXPECTED_FIELD_COUNT_BY_PULSE_TYPE[pulseType] : undefined;
    if (expectedFields === undefined || expectedFields === 0) {
      throw new Error(
        `IMPULSE : type d'impulsion "${pulseType ?? '?'}" non reconnu ou non implémenté (réponse "${response}").`,
      );
    }

    // Réponse documentée : plusieurs champs numériques dont l'Énergie (J),
    // la Tension/le Courant crête, les largeurs d'impulsion, etc. — non
    // décomposable en un seul MeasurementResult numérique. Renvoyée telle
    // quelle en attendant une structure ANSUR (.mtt réel) qui indique
    // comment ANSUR répartit ces valeurs entre éléments de test séparés.
    return { commandId, value: response, timestamp: new Date().toISOString() };
  }

  /** Envoie une commande ASCII (terminée par CR+LF) et attend la ligne de réponse. */
  private async transmit(command: string, timeoutMs: number): Promise<string> {
    const port = this.serialPort;
    if (!port) throw new InstrumentNotConnectedError('IMPULSE');

    const responsePromise = this.readLine(timeoutMs);
    await new Promise<void>((resolve, reject) => {
      port.write(`${command}\r\n`, (err) => (err ? reject(err) : resolve()));
    });
    const response = await responsePromise;

    if (response.startsWith('!')) {
      throw new Error(`IMPULSE : commande "${command}" refusée par l'instrument (${response}).`);
    }
    return response;
  }

  /** Attend une ligne complète (terminée par CR ou LF) sur le port, sans rien écrire. */
  private readLine(timeoutMs: number): Promise<string> {
    const port = this.serialPort;
    if (!port) throw new InstrumentNotConnectedError('IMPULSE');

    return new Promise<string>((resolve) => {
      let buffer = '';
      const onData = (chunk: Buffer): void => {
        buffer += chunk.toString('ascii');
        if (buffer.includes('\r') || buffer.includes('\n')) {
          clearTimeout(timer);
          port.off('data', onData);
          resolve(buffer.trim());
        }
      };
      const timer = setTimeout(() => {
        port.off('data', onData);
        resolve(buffer.trim());
      }, timeoutMs);

      port.on('data', onData);
    });
  }

  private static readonly ARM_TIMEOUT_MS = 5000;
  /** Généreux car l'opérateur doit déclencher manuellement le DUT (défibrillateur testé). */
  private static readonly DEFIB_PULSE_TIMEOUT_MS = 120_000;
}
