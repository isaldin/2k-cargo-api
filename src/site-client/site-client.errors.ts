export class SessionExpiredError extends Error {
  constructor(message = 'Upstream session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
