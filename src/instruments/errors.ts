/** Levée quand un instrument requis ne peut pas être connecté ou est introuvable. */
export class InstrumentNotAvailableError extends Error {
  constructor(
    public readonly instrumentId: string,
    public readonly portPath?: string,
    cause?: string,
  ) {
    const portInfo = portPath !== undefined ? ` sur le port "${portPath}"` : '';
    const causeInfo = cause !== undefined ? ` : ${cause}` : '';
    super(`Instrument "${instrumentId}" non disponible${portInfo}${causeInfo}.`);
    this.name = 'InstrumentNotAvailableError';
  }
}

/** Levée quand une commande est envoyée à un instrument non encore connecté. */
export class InstrumentNotConnectedError extends Error {
  constructor(public readonly instrumentId: string) {
    super(`Instrument "${instrumentId}" non connecté — appelez connect() avant d'envoyer des commandes.`);
    this.name = 'InstrumentNotConnectedError';
  }
}
