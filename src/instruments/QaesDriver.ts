import { SerialPort } from 'serialport';
import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

/**
 * Commandes QA-ES III supportées.
 *
 * Implémentation selon le manuel officiel Fluke "QA-ES III User
 * Communication Interface v1.1" : 115200 bauds, 8N1, contrôle de flux
 * matériel RTS/CTS obligatoire (le manuel précise explicitement que le
 * XON/XOFF logiciel n'est PAS utilisé).
 *
 * Contrairement à ESA620Driver/Ida4Driver, ces identifiants ne suivent PAS
 * la convention "PluginName:TestID" tirée d'un .mtt réel (aucun exemple de
 * fichier .mtt QA-ES n'était disponible au moment de l'écriture). Ils
 * nomment directement la commande protocole Fluke documentée (GENOUT,
 * HFLK). À revoir si un .mtt QA-ES réel devient disponible, pour aligner
 * les identifiants sur le TestID effectivement utilisé par ANSUR.
 *
 * Les paramètres de test (pédale Cut/Coag, résistance de charge, délai de
 * mesure) ne sont PAS déduits automatiquement : le manuel ne précise pas
 * quelles valeurs ANSUR utilisait pour quel test, et les deviner serait
 * risqué pour un test de sécurité électrique. Ils doivent être fournis
 * explicitement via le paramètre `params` de sendCommand().
 */
const QAES_SUPPORTED_COMMANDS = [
  'QAES:HFLK',   // Courant de fuite HF — toujours mesuré à travers 200 ohms
  'QAES:GENOUT', // Mesure de sortie générateur — puissance/courant/tension/facteur de crête
] as const satisfies readonly string[];

interface GenoutParams {
  readonly footswitch: 'CUT' | 'COAG';
  readonly loadOhms: number;
  /** Délai de mesure en dixièmes de seconde (2 à 250). Défaut : 20 (2,0 s). */
  readonly delayTenths?: number;
}

interface HflkParams {
  readonly footswitch: 'CUT' | 'COAG';
  readonly delayTenths?: number;
}

const DEFAULT_DELAY_TENTHS = 20;

function readNumberParam(
  params: Record<string, string | number> | undefined,
  key: string,
): number | undefined {
  const raw = params?.[key];
  if (raw === undefined) return undefined;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`QA-ES : paramètre "${key}" invalide ("${String(raw)}").`);
  }
  return value;
}

function readFootswitchParam(params: Record<string, string | number> | undefined): 'CUT' | 'COAG' {
  const raw = params?.['footswitch'];
  if (raw !== 'CUT' && raw !== 'COAG') {
    throw new Error(
      `QA-ES : paramètre "footswitch" requis et doit valoir "CUT" ou "COAG" (reçu "${String(raw)}").`,
    );
  }
  return raw;
}

/**
 * Driver pour l'analyseur d'électrochirurgie QA-ES III (Fluke Biomedical).
 * Communique via le port COM virtuel USB (FTDI) ou Bluetooth de l'instrument.
 *
 * Phase 4a : connexion/déconnexion, passage en mode Remote (RMAIN).
 * Phase 4b : GENOUT (mesure de sortie générateur) et HFLK (fuite HF), les
 *            deux seules commandes de mesure entièrement spécifiées par le
 *            manuel officiel. Les autres tests ANSUR possibles (distribution
 *            de puissance, alarme REM/RECM) ne sont pas implémentés : leur
 *            correspondance avec les commandes du manuel n'est pas évidente
 *            sans exemple de fichier .mtt réel.
 */
export class QaesDriver implements InstrumentDriver {
  readonly capabilities: InstrumentCapabilities = {
    instrumentId: 'QA-ES',
    supportedCommandIds: [...QAES_SUPPORTED_COMMANDS],
  };

  private serialPort: SerialPort | null = null;

  /**
   * @param portPath Chemin du port COM (ex. "COM6" sous Windows). Peut être
   *   un port USB virtuel (FTDI) ou un port Bluetooth "Outgoing".
   */
  constructor(public readonly portPath: string) {}

  async connect(): Promise<void> {
    if (this.serialPort?.isOpen) return;

    const port = await new Promise<SerialPort>((resolve, reject) => {
      const p = new SerialPort({
        path: this.portPath,
        baudRate: 115_200, // Confirmé par "QA-ES III User Communication Interface v1.1"
        rtscts: true, // Contrôle de flux matériel obligatoire (confirmé par le manuel)
        autoOpen: false,
      });

      p.open((err) => {
        if (err) {
          reject(new InstrumentNotAvailableError('QA-ES', this.portPath, err.message));
        } else {
          resolve(p);
        }
      });
    });

    this.serialPort = port;
    await this.transmit('REMOTE');
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

  async sendCommand(commandId: string, params?: Record<string, string | number>): Promise<void> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('QA-ES');

    if (commandId === 'QAES:GENOUT') {
      const footswitch = readFootswitchParam(params);
      const loadOhms = readNumberParam(params, 'loadOhms');
      if (loadOhms === undefined) {
        throw new Error('QA-ES : paramètre "loadOhms" requis pour QAES:GENOUT.');
      }
      const delayTenths = readNumberParam(params, 'delayTenths') ?? DEFAULT_DELAY_TENTHS;

      // LOAD= n'est légal que charge déconnectée : on la fixe avant CONN=TRUE.
      await this.transmit(`LOAD=${loadOhms}`);
      await this.transmit('CONN=TRUE');
      await this.transmit(`FTSW=${footswitch}`);
      await this.transmit(`DELAY=${delayTenths}`);
      return;
    }

    if (commandId === 'QAES:HFLK') {
      const footswitch = readFootswitchParam(params);
      const delayTenths = readNumberParam(params, 'delayTenths') ?? DEFAULT_DELAY_TENTHS;

      // HFLK utilise toujours 200 ohms en interne (LOAD= est ignoré pour ce
      // test selon le manuel) — on connecte quand même la charge.
      await this.transmit('LOAD=200');
      await this.transmit('CONN=TRUE');
      await this.transmit(`FTSW=${footswitch}`);
      await this.transmit(`DELAY=${delayTenths}`);
      return;
    }

    throw new Error(`QA-ES sendCommand("${commandId}") : aucune correspondance de commande connue.`);
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('QA-ES');

    if (commandId === 'QAES:GENOUT') {
      const response = await this.transmit('GENOUT');
      await this.transmit('CONN=FALSE'); // Sécurité : ne pas laisser la charge connectée.
      if (response === 'HOT') {
        throw new Error('QA-ES : mesure GENOUT refusée, instrument trop chaud (HOT).');
      }
      // Réponse documentée : "puissance,courant,tension_crête,facteur_crête"
      // ex. "245,4312,06867,07.3" — 4 valeurs, non décomposable en un seul
      // MeasurementResult numérique. Renvoyée telle quelle en attendant une
      // structure ANSUR (.mtt réel) qui indique comment ANSUR répartit ces
      // 4 valeurs entre éléments de test séparés.
      return { commandId, value: response, timestamp: new Date().toISOString() };
    }

    if (commandId === 'QAES:HFLK') {
      const response = await this.transmit('HFLK');
      await this.transmit('CONN=FALSE');
      if (response === 'HOT') {
        throw new Error('QA-ES : mesure HFLK refusée, instrument trop chaud (HOT).');
      }
      const value = Number(response);
      if (Number.isNaN(value)) {
        throw new Error(`QA-ES : réponse HFLK inattendue ("${response}").`);
      }
      return { commandId, value, timestamp: new Date().toISOString() };
    }

    throw new Error(`QA-ES readMeasurement("${commandId}") : aucune correspondance de commande connue.`);
  }

  /**
   * Envoie une commande ASCII (terminée par CR+LF) et attend la ligne de
   * réponse (terminée par CR+LF par le manuel). Lève une erreur explicite si
   * l'instrument répond par un des codes d'erreur documentés ("!", "!01"...).
   */
  private async transmit(command: string): Promise<string> {
    const port = this.serialPort;
    if (!port) throw new InstrumentNotConnectedError('QA-ES');

    const response = await new Promise<string>((resolve, reject) => {
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
      }, QaesDriver.RESPONSE_TIMEOUT_MS);

      port.on('data', onData);
      port.write(`${command}\r\n`, (err) => {
        if (err) {
          clearTimeout(timer);
          port.off('data', onData);
          reject(err);
        }
      });
    });

    if (response.startsWith('!')) {
      throw new Error(`QA-ES : commande "${command}" refusée par l'instrument (${response}).`);
    }
    return response;
  }

  private static readonly RESPONSE_TIMEOUT_MS = 10_000; // GENOUT/HFLK peuvent nécessiter un délai de mesure long.
}
