/** Kanalen er ikke sat op endnu (fx mangler afsenderdomæne eller WhatsApp-forbindelse). */
export class ChannelNotConfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelNotConfigured";
  }
}

/** Permanent fejl – genforsøg hjælper ikke (fx ugyldig modtager eller udløbet pushabonnement). */
export class PermanentSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentSendError";
  }
}
