import { SerialPort } from 'serialport';
import type { InstrumentCapabilities, InstrumentDriver, MeasurementResult } from './InstrumentDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

/**
 * Identifiants de commande ESA620 supportés, au format "ESA620:{TestID}"
 * (TestID = ID d'élément tel qu'il apparaît dans les fichiers .mtt ANSUR).
 *
 * Chaque commande est mise en œuvre selon "ESA620 User Communication
 * Interface v1.0" (Fluke Biomedical, doc officielle) : 115200 bauds, 8N1,
 * mode Remote (commandes ASCII en clair, pas le mode C Remote empaqueté).
 *
 * Certains tests ANSUR nécessitent une configuration des dérivations
 * patient ("Module Required" dans ansurESA620.mpc, ex. AP=/AP2=) que
 * l'opérateur choisit manuellement selon le DUT — cette configuration n'a
 * pas encore d'écran dédié dans l'application. Ces commandes sont donc
 * listées mais lèvent explicitement une erreur tant que ce choix n'est pas
 * capturé quelque part (voir REQUIRES_LEAD_CONFIGURATION ci-dessous).
 */
const ESA620_SUPPORTED_COMMANDS = [
  'ESA620:210',  // Tension secteur — Ligne / Neutre
  'ESA620:220',  // Tension secteur — Neutre / Terre
  'ESA620:230',  // Tension secteur — Ligne / Terre
  'ESA620:910',  // Fuite partie appliquée alternative — Secteur court-circuité (nécessite dérivations)
  'ESA620:1010', // Résistance d'isolement — Secteur / Terre de protection
  'ESA620:1020', // Résistance d'isolement — Parties appliquées / Terre (nécessite dérivations)
  'ESA620:1230', // Courant de fuite boîtier — Terre ouverte
  'ESA620:1260', // Courant de fuite boîtier — Terre ouverte, secteur inversé
  'ESA620:1310', // Courant de fuite patient — Condition normale (nécessite dérivations)
  'ESA620:1340', // Courant de fuite patient — Condition normale, secteur inversé (nécessite dérivations)
  'ESA620:1410', // Secteur sur parties appliquées — Défaut simple (nécessite dérivations)
  'ESA620:1420', // Secteur sur parties appliquées — Défaut simple, secteur inversé (nécessite dérivations)
  'ESA620:1610', // Fuite équipement alternative — Terre fermée
  'ESA620:1620', // Fuite équipement alternative — Terre ouverte
] as const satisfies readonly string[];

/**
 * Commandes de configuration (item REMOTE Mode Commands) à envoyer avant
 * READ pour chaque test, dans l'ordre. Correspondance test ANSUR ↔ commande
 * Fluke établie par recoupement entre les libellés de ansurESA620.mpc
 * (Type/Parameter/Name) et la description des commandes du manuel.
 */
const SETUP_COMMANDS: Readonly<Record<string, readonly string[]>> = {
  'ESA620:210': ['MAINS=L1-L2'],
  'ESA620:220': ['MAINS=L2-GND'],
  'ESA620:230': ['MAINS=L1-GND'],
  'ESA620:1010': ['MINS'],
  'ESA620:1230': ['ENCL'], // Courant de fuite boîtier, condition Terre ouverte
  'ESA620:1260': ['ENCL', 'POL=R'], // idem, secteur inversé
  'ESA620:1610': ['SAF', 'EARTH=C'], // Fuite équipement alternative (méthode substitut), terre fermée
  'ESA620:1620': ['SAF', 'EARTH=O'], // idem, terre ouverte
};

/**
 * Commandes dont l'exécution correcte dépend d'une configuration des
 * dérivations patient (AP=/AP2=) que l'opérateur choisit selon le DUT —
 * pas encore capturée par l'application. Documentées ici pour la suite :
 * la commande de test Fluke correspondante est indiquée en commentaire,
 * mais sendCommand() refuse de l'exécuter tant que la configuration des
 * dérivations n'est pas disponible (risque de mesurer sur les mauvaises
 * broches sans configuration explicite).
 */
const REQUIRES_LEAD_CONFIGURATION: Readonly<Record<string, string>> = {
  'ESA620:910': 'SPAT', // Fuite substitut patient (parties appliquées)
  'ESA620:1020': 'APINS', // Isolement parties appliquées
  'ESA620:1310': 'PAT + MODE=AC', // Fuite patient, condition normale
  'ESA620:1340': 'PAT + MODE=AC + POL=R', // idem, secteur inversé
  'ESA620:1410': 'MAP + MAP=NORM', // Secteur sur parties appliquées (MAP), défaut simple
  'ESA620:1420': 'MAP + MAP=REV', // idem, secteur inversé
};

/** Extrait la première valeur numérique (signée, décimale) d'une réponse texte. */
function parseNumericReading(response: string): number {
  const match = /-?\d+(\.\d+)?/.exec(response);
  if (!match) {
    throw new Error(`ESA620 : impossible d'extraire une valeur numérique de la réponse "${response}".`);
  }
  return Number(match[0]);
}

/**
 * Driver pour l'analyseur de sécurité électrique ESA620 (Fluke Biomedical).
 * Communique via le port COM virtuel créé par le driver USB Fluke, en mode
 * Remote (commandes ASCII terminées par CR — terminateur non documenté
 * explicitement dans le manuel pour ce mode, déduit par convention usuelle
 * des instruments Fluke de cette famille ; à confirmer sur matériel réel).
 *
 * Phase 4a : connexion/déconnexion, passage en mode Remote.
 * Phase 4b : commandes de mesure ne nécessitant pas de configuration de
 *            dérivations patient, selon "ESA620 User Communication
 *            Interface v1.0" (Fluke Biomedical, version 1.0, 05/06/2020).
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

    const port = await new Promise<SerialPort>((resolve, reject) => {
      const p = new SerialPort({
        path: this.portPath,
        baudRate: 115_200, // Confirmé par "ESA620 User Communication Interface v1.0"
        autoOpen: false,
      });

      p.open((err) => {
        if (err) {
          reject(new InstrumentNotAvailableError('ESA620', this.portPath, err.message));
        } else {
          resolve(p);
        }
      });
    });

    this.serialPort = port;
    // Passage en mode Remote : requis pour exécuter les commandes de test
    // (en mode Local, seules quelques commandes de statut sont acceptées).
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

  async sendCommand(commandId: string): Promise<void> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('ESA620');

    const leadCommand = REQUIRES_LEAD_CONFIGURATION[commandId];
    if (leadCommand !== undefined) {
      throw new Error(
        `ESA620 sendCommand("${commandId}") : ce test nécessite une configuration des dérivations ` +
          `patient (commande Fluke "${leadCommand}") non encore disponible dans l'application.`,
      );
    }

    const setup = SETUP_COMMANDS[commandId];
    if (setup === undefined) {
      throw new Error(`ESA620 sendCommand("${commandId}") : aucune correspondance de commande connue.`);
    }
    for (const command of setup) {
      await this.transmit(command);
    }
  }

  async readMeasurement(commandId: string): Promise<MeasurementResult> {
    if (!this.isConnected()) throw new InstrumentNotConnectedError('ESA620');
    if (SETUP_COMMANDS[commandId] === undefined) {
      throw new Error(`ESA620 readMeasurement("${commandId}") : aucune correspondance de commande connue.`);
    }

    const response = await this.transmit('READ');
    return {
      commandId,
      value: parseNumericReading(response),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Envoie une commande ASCII (terminée par CR) et attend la ligne de réponse.
   *
   * Le manuel ne documente explicitement une réponse que pour les commandes
   * de requête (IDENT, READ, SN, STAT...) ; les commandes d'action (REMOTE,
   * MAINS=, EARTH=...) n'ont pas de format de réponse garanti. Pour éviter un
   * blocage indéfini sur ces dernières, la promesse se résout aussi après un
   * délai (RESPONSE_TIMEOUT_MS) avec ce qui a été reçu jusque-là (chaîne vide
   * si rien).
   */
  private transmit(command: string): Promise<string> {
    const port = this.serialPort;
    if (!port) throw new InstrumentNotConnectedError('ESA620');

    return new Promise<string>((resolve, reject) => {
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
      }, Esa620Driver.RESPONSE_TIMEOUT_MS);

      port.on('data', onData);
      port.write(`${command}\r`, (err) => {
        if (err) {
          clearTimeout(timer);
          port.off('data', onData);
          reject(err);
        }
      });
    });
  }

  private static readonly RESPONSE_TIMEOUT_MS = 5000;
}
