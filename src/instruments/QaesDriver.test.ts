import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock est hissé en tête de fichier par Vitest : le mock est actif avant
// l'import de QaesDriver même si cette déclaration apparaît après.
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
      if (command === 'GENOUT') {
        queueMicrotask(() => this.emit('data', Buffer.from('245,4312,06867,07.3\r\n')));
      } else if (command === 'HFLK') {
        queueMicrotask(() => this.emit('data', Buffer.from('0012\r\n')));
      } else if (command === 'BADPARAM') {
        queueMicrotask(() => this.emit('data', Buffer.from('!03\r\n')));
      } else {
        // REMOTE, LOAD=, CONN=, FTSW=, DELAY= : réponse standard "*"
        queueMicrotask(() => this.emit('data', Buffer.from('*\r\n')));
      }
      callback(null);
    }
  },
}));

import { QaesDriver } from './QaesDriver.js';
import { InstrumentNotAvailableError, InstrumentNotConnectedError } from './errors.js';

describe('QaesDriver — structure', () => {
  it('déclare "QA-ES" comme instrumentId', () => {
    const driver = new QaesDriver('COM6');
    expect(driver.capabilities.instrumentId).toBe('QA-ES');
  });

  it('expose le portPath passé au constructeur', () => {
    const driver = new QaesDriver('COM9');
    expect(driver.portPath).toBe('COM9');
  });

  it('supporte HFLK et GENOUT', () => {
    const driver = new QaesDriver('COM6');
    expect(driver.capabilities.supportedCommandIds).toContain('QAES:HFLK');
    expect(driver.capabilities.supportedCommandIds).toContain('QAES:GENOUT');
  });
});

describe('QaesDriver — connexion', () => {
  it('lève InstrumentNotAvailableError si le port est introuvable', async () => {
    const driver = new QaesDriver('COM_INEXISTANT');
    await expect(driver.connect()).rejects.toBeInstanceOf(InstrumentNotAvailableError);
  });

  it('isConnected() devient vrai après connect()', async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    expect(driver.isConnected()).toBe(true);
  });
});

describe('QaesDriver — commandes sans connexion', () => {
  it('sendCommand() lève InstrumentNotConnectedError', async () => {
    const driver = new QaesDriver('COM6');
    await expect(
      driver.sendCommand('QAES:HFLK', { footswitch: 'CUT' }),
    ).rejects.toBeInstanceOf(InstrumentNotConnectedError);
  });

  it('readMeasurement() lève InstrumentNotConnectedError', async () => {
    const driver = new QaesDriver('COM6');
    await expect(driver.readMeasurement('QAES:HFLK')).rejects.toBeInstanceOf(
      InstrumentNotConnectedError,
    );
  });
});

describe('QaesDriver — validation des paramètres', () => {
  it('sendCommand("QAES:HFLK") exige le paramètre footswitch', async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    await expect(driver.sendCommand('QAES:HFLK', {})).rejects.toThrow(/footswitch/);
  });

  it('sendCommand("QAES:GENOUT") exige le paramètre loadOhms', async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    await expect(
      driver.sendCommand('QAES:GENOUT', { footswitch: 'CUT' }),
    ).rejects.toThrow(/loadOhms/);
  });
});

describe('QaesDriver — HFLK', () => {
  it('mesure le courant de fuite HF', async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    await driver.sendCommand('QAES:HFLK', { footswitch: 'CUT' });
    const result = await driver.readMeasurement('QAES:HFLK');
    expect(result.value).toBe(12);
    expect(result.commandId).toBe('QAES:HFLK');
  });
});

describe('QaesDriver — GENOUT', () => {
  it('mesure la sortie générateur et renvoie la réponse CSV brute', async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    await driver.sendCommand('QAES:GENOUT', { footswitch: 'COAG', loadOhms: 100 });
    const result = await driver.readMeasurement('QAES:GENOUT');
    expect(result.value).toBe('245,4312,06867,07.3');
  });
});

describe('QaesDriver — erreurs protocolaires', () => {
  it("lève une erreur explicite quand l'instrument répond par un code d'erreur", async () => {
    const driver = new QaesDriver('COM6');
    await driver.connect();
    await expect((driver as unknown as { transmit(cmd: string): Promise<string> }).transmit('BADPARAM')).rejects.toThrow(
      /refusée/,
    );
  });
});
