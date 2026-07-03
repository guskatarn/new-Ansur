import type { ElementResultStatus } from '../domain/types.js';

/** Résultat en cours de saisie pour un élément de test (avant validation finale). */
export interface DraftResult {
  /** null = l'opérateur n'a pas encore décidé pour cet élément. */
  status: ElementResultStatus | null;
  /** Valeur numérique saisie (chaîne brute pour garder le contrôle de l'input). */
  measuredValue: string;
  /** Note libre, optionnelle. */
  note: string;
}
