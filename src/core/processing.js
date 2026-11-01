import { IllegalTransition } from './errors.js';

/** Keep status. Capture success and extraction success are separate: a Keep is saved before any extractor runs. */
export const STATUS = Object.freeze({
  SAVED: 'saved',
  PROCESSING: 'processing',
  READY: 'ready',
  PARTIAL: 'partial',
  ATTENTION: 'attention',
  FAILED: 'failed',
});

const T = {
  saved: ['processing'],
  processing: ['ready', 'partial', 'attention', 'failed'],
  ready: ['processing'],
  partial: ['processing'],
  attention: ['processing'],
  failed: ['processing'],
};

/** @param {string} from @param {string} to @returns {boolean} */
export function canTransition(from, to) {
  return Boolean(T[from] && T[from].includes(to));
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {string} the new status
 * @throws {IllegalTransition}
 */
export function transition(from, to) {
  if (!canTransition(from, to)) throw new IllegalTransition(`Cannot go from ${from} to ${to}`, { code: 'illegal_transition' });
  return to;
}
