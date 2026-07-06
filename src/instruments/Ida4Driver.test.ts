import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

// vi.mock est hissé en tête de fichier par Vitest : le mock est actif avant
// l'import d'Ida4Driver même si cette déclaration apparaît après.
vi.mock('serialport', () => ({
  SerialPort: class MockSerialPort extends EventEmitter {
    private readonly _path: string;
    private _open = false;

    constructor(opts: { path: string; baudRate: number; autoOpen: boolean }) {
      super();
      this._path = opts.path;
    }

    get isOpen(): boolean {
      return this._open;
    }

    open(callback: (err: Error | null) => void): void {
      if (this._path === 'COM_INEXISTANT') {
        callback(new Error(`Cannot open ${this._path}: No such port`));
        return;
      }
      this._open = true;
      callback(null);
    }

    close(callback: () => void): void {
      this._open = false;
      callback();
    }

    write(data: string, callback: (err: Error | null | undefined) => void): void {
      // Simule la réponse de l'instrument selon la trame envoyée.
      if (data === '[GETSN]\r\n') {
        queueMicrotask(() => this.emit('data', Buffer.from('[SN ,12345]')));
      } else if (data === '[STATUS]\r\n') {
        queueMicrotask(() => this.emit('data', Buffer.from('[STAT,READY]')));
      }
      callback(null);
    }
  },
}));

import { Ida4Driver } from './Ida4Driver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

describe('Ida4Driver — structure', () => {
  it('déclare "IDA-4" comme instrumentId', () => {
    const driver = new Ida4Driver('COM4');
    expect(driver.capabilities.instrumentId).toBe('IDA-4');
  });

  it('expose le portPath passé au constructeur', () => {
    const driver = new Ida4Driver('COM7');
    expect(driver.portPath).toBe('COM7');
  });

  it("n'est pas connecté avant connect()", () => {
    const driver = new Ida4Driver('COM4');
    expect(driver.isConnected()).toBe(false);
  });

  it('supporte GETSN et STATUS', () => {
    const driver = new Ida4Driver('COM4');
    expect(driver.capabilities.supportedCommandIds).toContain('IDA4:GETSN');
    expect(driver.capabilities.supportedCommandIds).toContain('IDA4:STATUS');
  });
});

describe('Ida4Driver — connexion', () => {
  it('lève InstrumentNotAvailableError si le port est introuvable', async () => {
    const driver = new Ida4Driver('COM_INEXISTANT');
    await expect(driver.connect()).rejects.toBeInstanceOf(InstrumentNotAvailableError);
  });

  it("mentionne l'instrument et le port dans le message d'erreur", async () => {
    const driver = new Ida4Driver('COM_INEXISTANT');
    const err = await driver.connect().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InstrumentNotAvailableError);
    expect((err as InstrumentNotAvailableError).message).toContain('IDA-4');
    expect((err as InstrumentNotAvailableError).message).toContain('COM_INEXISTANT');
  });

  it('isConnected() devient vrai après connect()', async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    expect(driver.isConnected()).toBe(true);
  });
});

describe('Ida4Driver — commandes sans connexion', () => {
  it('sendCommand() lève InstrumentNotConnectedError', async () => {
    const driver = new Ida4Driver('COM4');
    await expect(driver.sendCommand('IDA4:GETSN')).rejects.toBeInstanceOf(InstrumentNotConnectedError);
  });

  it('readMeasurement() lève InstrumentNotConnectedError', async () => {
    const driver = new Ida4Driver('COM4');
    await expect(driver.readMeasurement('IDA4:GETSN')).rejects.toBeInstanceOf(InstrumentNotConnectedError);
  });
});

describe('Ida4Driver — commandes non confirmées', () => {
  it('sendCommand() rejette une commande hors protocole confirmé', async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    await expect(driver.sendCommand('IDA4:VOL')).rejects.toThrow(/non confirmé/);
  });

  it('readMeasurement() rejette une commande hors protocole confirmé', async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    await expect(driver.readMeasurement('IDA4:VOL')).rejects.toThrow(/non confirmé/);
  });
});

describe('Ida4Driver — GETSN', () => {
  it('envoie "[GETSN]" et lit le numéro de série depuis la réponse', async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    await driver.sendCommand('IDA4:GETSN');
    const result = await driver.readMeasurement('IDA4:GETSN');
    expect(result.value).toBe('12345');
    expect(result.commandId).toBe('IDA4:GETSN');
  });
});

describe('Ida4Driver — STATUS', () => {
  it('envoie "[STATUS]" et lit l\'état depuis la réponse', async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    await driver.sendCommand('IDA4:STATUS');
    const result = await driver.readMeasurement('IDA4:STATUS');
    expect(result.value).toBe('READY');
  });

  it("readMeasurement() sans sendCommand() préalable lève une erreur explicite", async () => {
    const driver = new Ida4Driver('COM4');
    await driver.connect();
    await expect(driver.readMeasurement('IDA4:STATUS')).rejects.toThrow(/réponse inattendue/);
  });
});
