import type { InstrumentDriver } from './InstrumentDriver.js';

/**
 * Registre des drivers d'instruments disponibles dans l'application.
 * Fait le lien entre le nom de plugin ANSUR tel qu'il apparaît dans les fichiers
 * .mtt (ex. "ESA620") et l'instance de driver correspondante.
 *
 * Une seule instance de registre est maintenue dans le process principal Electron ;
 * elle est peuplée au démarrage avec les drivers configurés (port sélectionné par
 * l'utilisateur dans les préférences).
 */
export class DriverRegistry {
  private readonly drivers = new Map<string, InstrumentDriver>();

  register(pluginName: string, driver: InstrumentDriver): void {
    this.drivers.set(pluginName, driver);
  }

  get(pluginName: string): InstrumentDriver | undefined {
    return this.drivers.get(pluginName);
  }

  has(pluginName: string): boolean {
    return this.drivers.has(pluginName);
  }

  /** Noms de tous les plugins enregistrés (correspond aux noms dans les .mtt). */
  registeredPluginNames(): readonly string[] {
    return [...this.drivers.keys()];
  }
}
