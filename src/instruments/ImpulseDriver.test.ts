import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock est hissé en tête de fichier par Vitest : le mock est actif avant
// l'import d'ImpulseDriver même si cette déclaration apparaît après.
vi.mock('serialport', () => ({
  SerialPort: class MockSerialPort extends EventEmitter {
    private readonly _path: string;
    private _open = false;

    constructor(opts: { path: string; baudRate: number; rtscts: boolean; autoOpen: boolean }) {
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
      const command = data.replace(/\r\n$/, '');
      // REMOTE, MODE=DEFIB, DREADY (accusé de réception immédiat) : "*"
      // La ligne de données de choc réelle est émise séparément par les
      // tests via `port.emit('data', ...)`, pas depuis write().
      queueMicrotask(() => this.emit('data', Buffer.from('*\r\n')));
      void command;
      callback(null);
    }
  },
}));

import { ImpulseDriver } from './ImpulseDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

describe('ImpulseDriver — structure', () => {
  it('déclare "IMPULSE" comme instrumentId', () => {
    const driver = new ImpulseDriver('COM7');
    expect(driver.capabilities.instrumentId).toBe('IMPULSE');
  });

  it('supporte IMPULSE:DEFIB_PULSE', () => {
    const driver = new ImpulseDriver('COM7');
    expect(driver.capabilities.supportedCommandIds).toContain('IMPULSE:DEFIB_PULSE');
  });
});

describe('ImpulseDriver — connexion', () => {
  it('lève InstrumentNotAvailableError si le port est introuvable', async () => {
    const driver = new ImpulseDriver('COM_INEXISTANT');
    await expect(driver.connect()).rejects.toBeInstanceOf(InstrumentNotAvailableError);
  });

  it('isConnected() devient vrai après connect()', async () => {
    const driver = new ImpulseDriver('COM7');
    await driver.connect();
    expect(driver.isConnected()).toBe(true);
  });
});

describe('ImpulseDriver — commandes sans connexion', () => {
  it('sendCommand() lève InstrumentNotConnectedError', async () => {
    const driver = new ImpulseDriver('COM7');
    await expect(driver.sendCommand('IMPULSE:DEFIB_PULSE')).rejects.toBeInstanceOf(
      InstrumentNotConnectedError,
    );
  });

  it('readMeasurement() lève InstrumentNotConnectedError', async () => {
    const driver = new ImpulseDriver('COM7');
    await expect(driver.readMeasurement('IMPULSE:DEFIB_PULSE')).rejects.toBeInstanceOf(
      InstrumentNotConnectedError,
    );
  });
});

describe('ImpulseDriver — mesure d\'impulsion de défibrillation', () => {
  it('arme la mesure (sendCommand) puis lit une impulsion monophasique', async () => {
    const driver = new ImpulseDriver('COM7');
    await driver.connect();
    await driver.sendCommand('IMPULSE:DEFIB_PULSE');

    const readPending = driver.readMeasurement('IMPULSE:DEFIB_PULSE');
    // Simule le DUT délivrant un choc après l'armement.
    const port = (driver as unknown as { serialPort: EventEmitter }).serialPort;
    port.emit('data', Buffer.from('1,123.4,2000,040.2,08.3,12.4,+120,N,012.3\r\n'));

    const result = await readPending;
    expect(result.value).toBe('1,123.4,2000,040.2,08.3,12.4,+120,N,012.3');
    expect(result.commandId).toBe('IMPULSE:DEFIB_PULSE');
  });

  it("lève une erreur explicite si aucune impulsion n'est détectée avant le délai", async () => {
    vi.useFakeTimers();
    try {
      const driver = new ImpulseDriver('COM7');
      const connectPending = driver.connect();
      await vi.runAllTimersAsync();
      await connectPending;

      const sendPending = driver.sendCommand('IMPULSE:DEFIB_PULSE');
      await vi.runAllTimersAsync();
      await sendPending;

      const readPending = driver.readMeasurement('IMPULSE:DEFIB_PULSE');
      const assertion = expect(readPending).rejects.toThrow(/aucune impulsion/);
      await vi.advanceTimersByTimeAsync(120_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
