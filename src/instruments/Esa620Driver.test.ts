import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock est hissé en tête de fichier par Vitest : le mock est actif avant
// l'import d'Esa620Driver même si cette déclaration apparaît après.
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
      const command = data.replace(/\r$/, '');
      if (command === 'READ') {
        queueMicrotask(() => this.emit('data', Buffer.from('125.3\r')));
      } else if (command === 'REMOTE') {
        // Commande d'action : pas de réponse documentée — on simule un silence
        // pour exercer le mécanisme de timeout du driver.
      } else {
        // Commandes de configuration (MAINS=, MINS, SAF, EARTH=...) : pas de
        // réponse documentée non plus.
      }
      callback(null);
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

  it("n'est pas connecté avant connect()", () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.isConnected()).toBe(false);
  });

  it("supporte les commandes de résistance d'isolement", () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1010');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1020');
  });

  it('supporte les commandes de courant de fuite patient', () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1310');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:1340');
  });

  it("supporte la commande de fuite partie appliquée alternative", () => {
    const driver = new Esa620Driver('COM3');
    expect(driver.capabilities.supportedCommandIds).toContain('ESA620:910');
  });
});

describe('Esa620Driver — connexion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lève InstrumentNotAvailableError si le port est introuvable', async () => {
    const driver = new Esa620Driver('COM_INEXISTANT');
    const pending = driver.connect();
    await expect(pending).rejects.toBeInstanceOf(InstrumentNotAvailableError);
  });

  it("mentionne l'instrument et le port dans le message d'erreur", async () => {
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

  it("se connecte et bascule en mode Remote même sans réponse (timeout)", async () => {
    const driver = new Esa620Driver('COM3');
    const pending = driver.connect();
    await vi.runAllTimersAsync();
    await pending;
    expect(driver.isConnected()).toBe(true);
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

describe('Esa620Driver — mesures (sans configuration de dérivations)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function connectedDriver(): Promise<Esa620Driver> {
    const driver = new Esa620Driver('COM3');
    const pending = driver.connect();
    await vi.runAllTimersAsync();
    await pending;
    return driver;
  }

  it('mesure la tension secteur Ligne/Neutre (ESA620:210)', async () => {
    const driver = await connectedDriver();
    const sendPending = driver.sendCommand('ESA620:210');
    await vi.runAllTimersAsync();
    await sendPending;

    const readPending = driver.readMeasurement('ESA620:210');
    await vi.runAllTimersAsync();
    const result = await readPending;

    expect(result.value).toBe(125.3);
    expect(result.commandId).toBe('ESA620:210');
  });

  it("mesure la résistance d'isolement secteur/terre (ESA620:1010)", async () => {
    const driver = await connectedDriver();
    const sendPending = driver.sendCommand('ESA620:1010');
    await vi.runAllTimersAsync();
    await sendPending;

    const readPending = driver.readMeasurement('ESA620:1010');
    await vi.runAllTimersAsync();
    const result = await readPending;

    expect(result.value).toBe(125.3);
  });
});

describe('Esa620Driver — commandes nécessitant une configuration de dérivations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sendCommand() refuse ESA620:910 (dérivations non configurées)', async () => {
    const driver = new Esa620Driver('COM3');
    const pending = driver.connect();
    await vi.runAllTimersAsync();
    await pending;

    await expect(driver.sendCommand('ESA620:910')).rejects.toThrow(/dérivations/);
  });

  it('sendCommand() refuse ESA620:1310 (dérivations non configurées)', async () => {
    const driver = new Esa620Driver('COM3');
    const pending = driver.connect();
    await vi.runAllTimersAsync();
    await pending;

    await expect(driver.sendCommand('ESA620:1310')).rejects.toThrow(/dérivations/);
  });
});
