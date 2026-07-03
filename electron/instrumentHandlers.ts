import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';
import { Esa620Driver } from '../src/instruments/Esa620Driver.js';
import { InstrumentNotAvailableError } from '../src/instruments/errors.js';

/**
 * Instance unique de l'ESA620 dans le process principal.
 * Remplacée à chaque tentative de connexion sur un nouveau port.
 */
let esa620: Esa620Driver | null = null;

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

  // ── Connexion de l'ESA620 sur le port choisi par l'utilisateur ───────────
  ipcMain.handle('instruments:connect-esa620', async (_event, portPath: string) => {
    try {
      if (esa620?.isConnected()) await esa620.disconnect();
      esa620 = new Esa620Driver(portPath);
      await esa620.connect();
      return { success: true as const };
    } catch (err) {
      const message =
        err instanceof InstrumentNotAvailableError
          ? err.message
          : `Erreur inattendue lors de la connexion : ${String(err)}`;
      return { success: false as const, error: message };
    }
  });

  // ── Déconnexion de l'ESA620 ───────────────────────────────────────────────
  ipcMain.handle('instruments:disconnect-esa620', async () => {
    if (esa620) {
      await esa620.disconnect();
      esa620 = null;
    }
  });

  // ── État de connexion courant ─────────────────────────────────────────────
  ipcMain.handle('instruments:status-esa620', () => ({
    connected: esa620?.isConnected() ?? false,
    portPath: esa620?.portPath ?? null,
  }));
}
