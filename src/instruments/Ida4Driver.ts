import { SerialPort } from 'serialport';
import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

/**
 * Commandes IDA-4 Plus supportées, au format "IDA4:{Nom}".
 *
 * Protocole texte entre crochets (ex. "[GETSN]", réponse "[SN ,<numéro>]")
 * reconstruit par analyse statique des chaînes embarquées dans les plug-ins
 * ANSUR d'origine (AnsurIDA4VTI.dll, AnsurIDALink.exe) — AUCUNE documentation
 * officielle Fluke disponible, non confirmé sur matériel réel.
 * Débit confirmé par la même analyse : 19200 bauds, 8N1.
 *
 * Seules les deux commandes ci-dessous ont une corrélation commande/préfixe
 * de réponse suffisamment nette pour être implémentées. D'autres commandes
 * ont été repérées dans les mêmes binaires mais leur format de réponse
 * (champs, unités, ordre) reste inconnu — à ne PAS implémenter sans capture
 * du trafic série réel ou documentation officielle :
 *   [GETPARAMS], [VOL], [PCATRIG,...], [PKPRES,...], [END,...], [LOG],
 *   [POLL], [BYE], [AMEND,...]
 */
const IDA4_SUPPORTED_COMMANDS = [
  'IDA4:GETSN', // Numéro de série de l'instrument — commande [GETSN], réponse "[SN ,<numéro>]"
  'IDA4:STATUS', // État de l'instrument — commande [STATUS], réponse "[STAT,<état>]"
] as const satisfies readonly string[];

const COMMAND_FRAMES: Readonly<Record<string, string>> = {
  'IDA4:GETSN': '[GETSN]',
  'IDA4:STATUS': '[STATUS]',
};

const RESPONSE_PREFIXES: Readonly<Record<string, string>> = {
  'IDA4:GETSN': '[SN ,',
  'IDA4:STATUS': '[STAT,',
};

/**
 * Driver pour l'analyseur de pompe à perfusion IDA-4 Plus (Fluke Biomedical).
 * Communique via le port COM virtuel créé par le driver USB/série Fluke.
 *
 * Phase 4a : connexion/déconnexion opérationnelles (débit confirmé par
 *            analyse statique des chaînes du plug-in ANSUR d'origine).
 * Phase 4b : implémentation best-effort des deux commandes d'identification
 *            les mieux corroborées (GETSN, STATUS).
 *
 * Le format général "[COMMAND,params]<CR><LF>" et les commandes GETSN/STATUS
 * (réponse "[STAT,...]") sont corroborés par le manuel officiel Fluke
 * "IDA-5 User Communication Interface v1.0" — un instrument de la même
 * famille produit par le même fabricant, dont le protocole partage
 * manifestement la même conception. Il n'existe cependant PAS de manuel
 * officiel spécifique à l'IDA-4 Plus : le débit (19200 bauds, contre 115200
 * pour l'IDA-5) et le détail exact des commandes restent déduits de
 * l'analyse statique du plug-in ANSUR d'origine, donc à confirmer sur
 * matériel réel avant tout usage en conditions réelles.
 */
export class Ida4Driver implements InstrumentDriver {
  readonly capabilities: InstrumentCapabilities = {
    instrumentId: 'IDA-4',
    supportedCommandIds: [...IDA4_SUPPORTED_COMMANDS],
  };

  private serialPort: SerialPort | null = null;

  /**
   * @param portPath Chemin du port COM (ex. "COM4" sous Windows).
   *   Sélectionné manuellement par l'utilisateur dans les préférences.
   */
  constructor(public readonly portPath: string) {}

  async connect(): Promise<void> {
    if (this.serialPort?.isOpen) return;

    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort({
        path: this.portPath,
        baudRate: 19200,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          reject(new InstrumentNotAvailableError('IDA-4', this.portPath, err.message));
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
    if (!this.isConnected()) throw new InstrumentNotConnectedError('IDA-4');
    const frame = COMMAND_FRAMES[commandId];
    if (frame === undefined) {
      throw new Error(
        `IDA-4 sendCommand("${commandId}") : protocole non confirmé pour cette commande (nécessite capture du trafic série réel).`,
      );
    }
    const response = await this.transmit(frame);
    this.lastResponses.set(commandId, response);
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('IDA-4');
    const prefix = RESPONSE_PREFIXES[commandId];
    if (prefix === undefined) {
      throw new Error(
        `IDA-4 readMeasurement("${commandId}") : protocole non confirmé pour cette commande (nécessite capture du trafic série réel).`,
      );
    }
    const response = this.lastResponses.get(commandId);
    if (response === undefined || !response.startsWith(prefix)) {
      throw new Error(
        `IDA-4 readMeasurement("${commandId}") : réponse inattendue de l'instrument ("${response ?? '(aucune)'}").`,
      );
    }
    const withoutPrefix = response.slice(prefix.length);
    const payload = withoutPrefix.endsWith(']') ? withoutPrefix.slice(0, -1) : withoutPrefix;

    return {
      commandId,
      value: payload.trim(),
      timestamp: new Date().toISOString(),
    };
  }

  private readonly lastResponses = new Map<string, string>();

  private transmit(frame: string): Promise<string> {
    const port = this.serialPort;
    if (!port) throw new InstrumentNotConnectedError('IDA-4');

    return new Promise<string>((resolve, reject) => {
      let buffer = '';
      const onData = (chunk: Buffer): void => {
        buffer += chunk.toString('ascii');
        if (buffer.includes(']')) {
          port.off('data', onData);
          resolve(buffer.trim());
        }
      };
      port.on('data', onData);
      port.write(`${frame}\r\n`, (err) => {
        if (err) {
          port.off('data', onData);
          reject(err);
        }
      });
    });
  }
}
