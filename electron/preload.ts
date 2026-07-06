import { contextBridge, ipcRenderer } from 'electron';
import type { AuditEntry, DutInfo, ElementResult, ElementResultStatus, HistoryEntry, TestTemplate } from '../src/domain/types.js';

/**
 * API exposée au renderer (React) via window.ansurAPI.
 * Aucun accès direct à Node.js ou Electron depuis le code React :
 * tout passe par ce pont explicite et typé.
 */
const ansurAPI = {
  // ── Rapports PDF ──────────────────────────────────────────────────────────
  generatePdfReport: (htmlContent: string, outputPath: string) =>
    ipcRenderer.invoke('report:generate-pdf', htmlContent, outputPath) as Promise<{
      success: boolean;
      path: string;
    }>,

  // ── Rapports PDF (avec dialogue de sauvegarde) ────────────────────────────
  report: {
    /**
     * Ouvre la boîte de dialogue "Enregistrer sous", génère le PDF à partir
     * du HTML fourni et l'écrit sur le chemin choisi par l'utilisateur.
     */
    savePdfDialog: (
      htmlContent: string,
    ): Promise<
      | { canceled: true }
      | { success: true; path: string }
      | { success: false; error: string }
    > => ipcRenderer.invoke('report:save-as-pdf', htmlContent),
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  templates: {
    /** Liste tous les templates (dernière version de chaque). */
    list: (): Promise<TestTemplate[]> => ipcRenderer.invoke('templates:list'),

    /** Récupère un template par id, optionnellement à une version précise. */
    get: (id: string, version?: number): Promise<TestTemplate | undefined> =>
      ipcRenderer.invoke('templates:get', id, version),

    /** Sauvegarde un template (écrase si la version existe déjà). */
    save: (template: TestTemplate): Promise<{ success: true }> =>
      ipcRenderer.invoke('templates:save', template),

    /**
     * Ouvre la boîte de dialogue "Enregistrer sous" et exporte le template
     * courant en fichier .json lisible.
     */
    export: (
      template: TestTemplate,
    ): Promise<{ canceled: true } | { success: true; path: string } | { success: false; error: string }> =>
      ipcRenderer.invoke('templates:export', template),

    /**
     * Affiche un dialogue de confirmation natif, puis supprime toutes les
     * versions du template (dossier complet sur le disque).
     */
    delete: (
      id: string,
    ): Promise<{ canceled: true } | { success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('templates:delete', id),

    /** Crée une copie du template avec un nouvel id et version 1. */
    duplicate: (
      id: string,
    ): Promise<{ success: true; template: TestTemplate } | { success: false; error: string }> =>
      ipcRenderer.invoke('templates:duplicate', id),

    /** Ouvre la boîte de dialogue de sélection de fichier .mtt et importe. */
    importMtt: (): Promise<
      | { canceled: true }
      | { canceled: false; success: true; template: TestTemplate; warnings: readonly string[] }
      | { canceled: false; success: false; error: string }
    > => ipcRenderer.invoke('templates:import-mtt'),
  },

  // ── Records de test ───────────────────────────────────────────────────────
  records: {
    /**
     * Enregistre une séquence + un record de test immuable.
     * Les IDs sont générés côté main process.
     */
    saveRun: (params: {
      dut: DutInfo;
      executedBy: string;
      templateId: string;
      templateVersion: number;
      results: readonly ElementResult[];
      overallStatus: ElementResultStatus;
    }): Promise<{ success: true; recordId: string; executedAt: string }> =>
      ipcRenderer.invoke('records:save-run', params),

    /** Retourne tous les records, du plus récent au plus ancien. */
    list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('records:list'),
  },

  // ── Application ───────────────────────────────────────────────────────────
  app: {
    /** Retourne les infos d'environnement (versions, chemins de données). */
    getInfo: (): Promise<{
      appVersion: string;
      electronVersion: string;
      nodeVersion: string;
      dataRoot: string;
      templatesDir: string;
      sequencesDir: string;
      recordsDir: string;
      auditLogPath: string;
    }> => ipcRenderer.invoke('app:info'),

    /** Ouvre le dossier de données dans l'Explorateur Windows. */
    openDataFolder: (): Promise<{ success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('app:open-data-folder'),
  },

  // ── Journal d'audit ───────────────────────────────────────────────────────
  audit: {
    /** Retourne toutes les entrées du journal d'audit, du plus récent au plus ancien. */
    list: (): Promise<AuditEntry[]> => ipcRenderer.invoke('audit:list'),
  },

  // ── Instruments ───────────────────────────────────────────────────────────
  instruments: {
    /** Liste les ports série (COM) disponibles sur la machine. */
    listPorts: (): Promise<
      Array<{ path: string; manufacturer: string | null; serialNumber: string | null }>
    > => ipcRenderer.invoke('instruments:list-ports'),

    /** Tente de connecter l'ESA620 sur le port indiqué. */
    connectEsa620: (
      portPath: string,
    ): Promise<{ success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('instruments:connect-esa620', portPath),

    /** Déconnecte l'ESA620. */
    disconnectEsa620: (): Promise<void> =>
      ipcRenderer.invoke('instruments:disconnect-esa620'),

    /** Retourne l'état de connexion courant de l'ESA620. */
    statusEsa620: (): Promise<{ connected: boolean; portPath: string | null }> =>
      ipcRenderer.invoke('instruments:status-esa620'),

    /** Tente de connecter le QA-ES III sur le port indiqué. */
    connectQaes: (
      portPath: string,
    ): Promise<{ success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('instruments:connect-qaes', portPath),

    /** Déconnecte le QA-ES III. */
    disconnectQaes: (): Promise<void> =>
      ipcRenderer.invoke('instruments:disconnect-qaes'),

    /** Retourne l'état de connexion courant du QA-ES III. */
    statusQaes: (): Promise<{ connected: boolean; portPath: string | null }> =>
      ipcRenderer.invoke('instruments:status-qaes'),

    /** Tente de connecter l'Impulse 6000D/7000DP sur le port indiqué. */
    connectImpulse: (
      portPath: string,
    ): Promise<{ success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('instruments:connect-impulse', portPath),

    /** Déconnecte l'Impulse. */
    disconnectImpulse: (): Promise<void> =>
      ipcRenderer.invoke('instruments:disconnect-impulse'),

    /** Retourne l'état de connexion courant de l'Impulse. */
    statusImpulse: (): Promise<{ connected: boolean; portPath: string | null }> =>
      ipcRenderer.invoke('instruments:status-impulse'),

    /** Tente de connecter l'IDA-4 Plus sur le port indiqué. */
    connectIda4: (
      portPath: string,
    ): Promise<{ success: true } | { success: false; error: string }> =>
      ipcRenderer.invoke('instruments:connect-ida4', portPath),

    /** Déconnecte l'IDA-4 Plus. */
    disconnectIda4: (): Promise<void> =>
      ipcRenderer.invoke('instruments:disconnect-ida4'),

    /** Retourne l'état de connexion courant de l'IDA-4 Plus. */
    statusIda4: (): Promise<{ connected: boolean; portPath: string | null }> =>
      ipcRenderer.invoke('instruments:status-ida4'),

    /**
     * Pilote automatiquement l'instrument connecté correspondant au préfixe
     * de `commandId` (ex. "ESA620:210" → ESA620) : envoie la commande puis
     * lit la mesure. Retourne une erreur explicite si aucun instrument
     * compatible n'est connecté, si la commande n'est pas supportée, ou si
     * des paramètres sont manquants (ex. dérivations patient, pédale QA-ES).
     */
    runMeasurement: (
      commandId: string,
      params?: Record<string, string | number>,
    ): Promise<
      | { success: true; value: number | boolean | string; unit: string | null; timestamp: string }
      | { success: false; error: string }
    > => ipcRenderer.invoke('instruments:run-measurement', commandId, params),
  },
};

contextBridge.exposeInMainWorld('ansurAPI', ansurAPI);

export type AnsurAPI = typeof ansurAPI;
