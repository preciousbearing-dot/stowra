/** Typed errors. The UI maps each type to a plain message. Messages never contain keys or page text. */
export class AppError extends Error {
  /** @param {string} message @param {{code?: string, cause?: unknown}} [opts] */
  constructor(message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code || 'unknown';
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}
export class NetworkError extends AppError {}
export class ProviderError extends AppError {}
export class ExtractionError extends AppError {}
export class StorageError extends AppError {}
export class UserError extends AppError {}
export class IllegalTransition extends AppError {}

/**
 * Plain, calm message for the screen.
 * @param {unknown} err
 * @returns {string}
 */
export function userMessage(err) {
  if (err instanceof UserError) return err.message;
  if (err instanceof NetworkError) return 'No connection right now. Your Keeps are safe and this will retry.';
  if (err instanceof ProviderError) return 'The AI provider did not answer. Check your key in Settings.';
  if (err instanceof ExtractionError) return 'Stowra could not read this one. It is still saved.';
  if (err instanceof StorageError) return 'Stowra could not save to your phone. Check free space and try again.';
  return 'Something went wrong. Nothing was lost.';
}
