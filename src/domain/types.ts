/**
 * Modèle de domaine, indépendant de l'UI et du matériel.
 * Calqué sur les concepts ANSUR : Test Element, Test Template, Test Sequence,
 * Test Record, DUT, Limits.
 */

export type TestElementKind = 'measurement' | 'manual-step' | 'visual-checklist';

/** Limite pass/fail appliquée à une mesure numérique. */
export interface NumericLimit {
  readonly kind: 'numeric';
  readonly min?: number;
  readonly max?: number;
  readonly unit: string;
}

/** Limite booléenne (ex. case à cocher "OK visuellement"). */
export interface BooleanLimit {
  readonly kind: 'boolean';
  readonly expected: boolean;
}

export type Limit = NumericLimit | BooleanLimit;

/** Brique élémentaire d'un test : une mesure, une checklist visuelle, une étape manuelle. */
export interface TestElement {
  readonly id: string;
  readonly label: string;
  readonly kind: TestElementKind;
  /** Identifiant de la commande instrument à exécuter (résolu par le driver), absent si étape purement manuelle. */
  readonly instrumentCommandId?: string;
  readonly limit?: Limit;
  /** Texte de procédure affiché au technicien (extrait du champ RTF ANSUR, converti en texte brut). */
  readonly instructions?: string;
}

/** Définit comment tester un DUT (équivalent .mtt ANSUR). Versionné. */
export interface TestTemplate {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly createdAt: string; // ISO 8601
  readonly elements: readonly TestElement[];
}

/** Identification de l'équipement testé. */
export interface DutInfo {
  readonly serialNumber: string;
  readonly model: string;
  readonly location?: string;
}

/** Un template + les infos du DUT (équivalent .mts ANSUR). */
export interface TestSequence {
  readonly id: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly dut: DutInfo;
}

export type ElementResultStatus = 'pass' | 'fail' | 'skipped' | 'not-applicable';

export interface ElementResult {
  readonly elementId: string;
  readonly status: ElementResultStatus;
  readonly measuredValue?: number | boolean;
  readonly note?: string;
}

/**
 * Une séquence + les résultats après exécution (équivalent .mtr ANSUR).
 * Immuable une fois créé : toute correction se fait par un nouveau record,
 * jamais par mutation (exigence de piste d'audit).
 */
export interface TestRecord {
  readonly id: string;
  readonly sequenceId: string;
  readonly executedAt: string; // ISO 8601
  readonly executedBy: string; // identifiant utilisateur
  readonly results: readonly ElementResult[];
  readonly overallStatus: ElementResultStatus;
}

/** Entrée du journal d'audit (JSONL — une ligne = un événement). */
export interface AuditEntry {
  readonly occurredAt: string; // ISO 8601
  readonly actor: string;
  readonly action: string;
  readonly details?: unknown;
}

/** Vue jointe record + séquence, utilisée par l'écran Historique. */
export interface HistoryEntry {
  readonly recordId: string;
  readonly executedAt: string;
  readonly executedBy: string;
  readonly overallStatus: ElementResultStatus;
  readonly dut: DutInfo;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly results: readonly ElementResult[];
}
