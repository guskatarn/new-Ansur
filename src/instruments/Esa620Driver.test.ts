import { describe, expect, it, vi } from 'vitest';

// vi.mock est hissé en tête de fichier par Vitest : le mock est actif avant
// l'import d'Esa620Driver même si cette déclaration apparaît après.
vi.mock('serialport', () => ({
  SerialPort: class MockSerialPort {
    private readonly _path: string;

    constructor(opts: { path: string; baudRate: number; autoOpen: boolean }) {
      this._path = opts.path;
    }

    get isOpen(): boolean {
      return false;
    }

    open(callback: (err: Error | null) => void): void {
      // Simule systématiquement un port introuvable
      callback(new Error(`Cannot open ${this._path}: No such port`));
    }

    close(callback: () => void): void {
      callback();
    }
  },
}));

import { Esa620Driver } from './Esa620Driver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

describe('Esa620Driver — structure', () => {
  it('déclare "ESA620" comme instrumentId', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.instrumentId).toBe('ESA620');
  });

  it('expose le portPath passé au constructeur', () => {
    const driver = new Esa620Driver('COM5');
    expect(driver.portPath).toBe('COM5');
  });

  it('n\'est pas connecté avant connect()', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.isConnected()).toBe(false);
  });

  it('supporte les commandes de résistance d\'isolement', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1010');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1020');
  });

  it('supporte les commandes de courant de fuite patient', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1310');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1340');
  });

  it('supporte la commande de fuite partie appliquée alternative', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:910');
  });
});

describe('Esa620Driver — connexion', () => {
  it('lève InstrumentNotAvailableError si le port est introuvable', async () => {
    const driver = new Esa620Driver('COM_INEXISTANT');
    await expect(driver.connect()).rejects.toBeInstanceOf(InstrumentNotAvailableError);
  });

  it('mentionne l\'instrument et le port dans le message d\'erreur', async () => {
    const driver = new Esa620Driver('COM_INEXISTANT');
    const err = await driver.connect().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InstrumentNotAvailableError);
    expect((err as InstrumentNotAvailableError).message).toContain('ESA620');
    expect((err as InstrumentNotAvailableError).message).toContain('COM_INEXISTANT');
  });

  it('expose instrumentId et portPath sur l\'erreur', async () => {
    const driver = new Esa620Driver('COM_INEXISTANT');
    const err = await driver.connect().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InstrumentNotAvailableError);
    const notAvail = err as InstrumentNotAvailableError;
    expect(notAvail.instrumentId).toBe('ESA620');
    expect(notAvail.portPath).toBe('COM_INEXISTANT');
  });
});

describe('Esa620Driver — commandes sans connexion', () => {
  it('sendCommand() lève InstrumentNotConnectedError', async () => {
    const driver = new Esa620Driver('COM3');
    await expect(driver.sendCommand('ESA620:210')).rejects.toBeInstanceOf(
      InstrumentNotConnectedError,
    );
  });

  it('readMeasurement() lève InstrumentNotConnectedError', async () => {
    const driver = new Esa620Driver('COM3');
    await expect(driver.readMeasurement('ESA620:1010')).rejects.toBeInstanceOf(
      InstrumentNotConnectedError,
    );
  });
});
