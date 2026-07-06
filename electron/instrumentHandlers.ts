import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';
import { DriverRegistry } from '../src/instruments/DriverRegistry.js';
import { Esa620Driver } from '../src/instruments/Esa620Driver.js';
import { Ida4Driver } from '../src/instruments/Ida4Driver.js';
import { ImpulseDriver } from '../src/instruments/ImpulseDriver.js';
import { QaesDriver } from '../src/instruments/QaesDriver.js';
import { InstrumentNotAvailableError } from '../src/instruments/errors.js';

/**
 * Instances uniques de chaque instrument dans le process principal.
 * Remplacées à chaque tentative de connexion sur un nouveau port.
 */
let esa620: Esa620Driver | null = null;
let qaes: QaesDriver | null = null;
let impulse: ImpulseDriver | null = null;
let ida4: Ida4Driver | null = null;

/**
 * Registre associant le préfixe d'instrumentCommandId (tel qu'il apparaît
 * dans un .mtt : "ESA620:210", "QAES:HFLK"...) au driver actuellement
 * connecté. Alimenté à chaque connexion réussie, consommé par
 * "instruments:run-measurement" pour piloter automatiquement l'instrument
 * pendant l'exécution d'un test (voir TestRunnerView / ElementRunnerCard).
 */
const registry = new DriverRegistry();

function connectErrorMessage(err: unknown): string {
  return err instanceof InstrumentNotAvailableError
    ? err.message
    : `Erreur inattendue lors de la connexion : ${String(err)}`;
}

/**
 * Enregistre les handlers IPC liés aux instruments.
 * À appeler une seule fois depuis app.whenReady().
 */
export function registerInstrumentHandlers(): void {

  // ── Liste des ports série disponibles sur la machine ─────────────────────
  ipcMain.handle('instruments:list-ports', async () => {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? null,
      serialNumber: p.serialNumber ?? null,
    }));
  });

  // ── ESA620 ─────────────────────────────────────────────────────────────────
  ipcMain.handle('instruments:connect-esa620', async (_event, portPath: string) => {
    try {
      if (esa620?.isConnected()) await esa620.disconnect();
      esa620 = new Esa620Driver(portPath);
      await esa620.connect();
      registry.register('ESA620', esa620);
      return { success: true as const };
    } catch (err) {
      return { success: false as const, error: connectErrorMessage(err) };
    }
  });

  ipcMain.handle('instruments:disconnect-esa620', async () => {
    if (esa620) {
      await esa620.disconnect();
      esa620 = null;
    }
  });

  ipcMain.handle('instruments:status-esa620', () => ({
    connected: esa620?.isConnected() ?? false,
    portPath: esa620?.portPath ?? null,
  }));

  // ── QA-ES III ──────────────────────────────────────────────────────────────
  ipcMain.handle('instruments:connect-qaes', async (_event, portPath: string) => {
    try {
      if (qaes?.isConnected()) await qaes.disconnect();
      qaes = new QaesDriver(portPath);
      await qaes.connect();
      registry.register('QAES', qaes);
      return { success: true as const };
    } catch (err) {
      return { success: false as const, error: connectErrorMessage(err) };
    }
  });

  ipcMain.handle('instruments:disconnect-qaes', async () => {
    if (qaes) {
      await qaes.disconnect();
      qaes = null;
    }
  });

  ipcMain.handle('instruments:status-qaes', () => ({
    connected: qaes?.isConnected() ?? false,
    portPath: qaes?.portPath ?? null,
  }));

  // ── Impulse 6000D/7000DP ───────────────────────────────────────────────────
  ipcMain.handle('instruments:connect-impulse', async (_event, portPath: string) => {
    try {
      if (impulse?.isConnected()) await impulse.disconnect();
      impulse = new ImpulseDriver(portPath);
      await impulse.connect();
      registry.register('IMPULSE', impulse);
      return { success: true as const };
    } catch (err) {
      return { success: false as const, error: connectErrorMessage(err) };
    }
  });

  ipcMain.handle('instruments:disconnect-impulse', async () => {
    if (impulse) {
      await impulse.disconnect();
      impulse = null;
    }
  });

  ipcMain.handle('instruments:status-impulse', () => ({
    connected: impulse?.isConnected() ?? false,
    portPath: impulse?.portPath ?? null,
  }));

  // ── IDA-4 Plus ─────────────────────────────────────────────────────────────
  ipcMain.handle('instruments:connect-ida4', async (_event, portPath: string) => {
    try {
      if (ida4?.isConnected()) await ida4.disconnect();
      ida4 = new Ida4Driver(portPath);
      await ida4.connect();
      registry.register('IDA4', ida4);
      return { success: true as const };
    } catch (err) {
      return { success: false as const, error: connectErrorMessage(err) };
    }
  });

  ipcMain.handle('instruments:disconnect-ida4', async () => {
    if (ida4) {
      await ida4.disconnect();
      ida4 = null;
    }
  });

  ipcMain.handle('instruments:status-ida4', () => ({
    connected: ida4?.isConnected() ?? false,
    portPath: ida4?.portPath ?? null,
  }));

  // ── Pilotage automatique d'une mesure pendant l'exécution d'un test ──────
  // Résout l'instrument à partir du préfixe de instrumentCommandId (ex.
  // "ESA620:210" → préfixe "ESA620"), envoie la commande puis lit la mesure.
  ipcMain.handle(
    'instruments:run-measurement',
    async (_event, commandId: string, params?: Record<string, string | number>) => {
      const prefix = commandId.split(':')[0];
      const driver = prefix !== undefined ? registry.get(prefix) : undefined;
      if (!driver) {
        return {
          success: false as const,
          error: `Aucun instrument connecté ne peut exécuter "${commandId}".`,
        };
      }
      if (!driver.isConnected()) {
        return {
          success: false as const,
          error: `L'instrument pour "${commandId}" n'est plus connecté.`,
        };
      }
      try {
        await driver.sendCommand(commandId, params);
        const measurement = await driver.readMeasurement(commandId);
        return {
          success: true as const,
          value: measurement.value,
          unit: measurement.unit ?? null,
          timestamp: measurement.timestamp,
        };
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}
