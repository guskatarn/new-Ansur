import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';
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
}
