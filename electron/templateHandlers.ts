import { dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type { TestTemplate } from '../src/domain/types.js';
import { parseMttFile } from '../src/import/MttParser.js';
import { FileTemplateRepository } from '../src/persistence/TemplateRepository.js';

let repo: FileTemplateRepository | null = null;

export function registerTemplateHandlers(templatesDir: string): void {
  repo = new FileTemplateRepository(templatesDir);

  ipcMain.handle('templates:list', async (): Promise<TestTemplate[]> => {
    return repo!.listAll();
  });

  ipcMain.handle(
    'templates:get',
    async (_event, id: string, version?: number): Promise<TestTemplate | undefined> => {
      if (version !== undefined) {
        return repo!.findByIdAndVersion(id, version);
      }
      return repo!.findLatestVersion(id);
    },
  );

  ipcMain.handle(
    'templates:save',
    async (_event, template: TestTemplate): Promise<{ success: true }> => {
      await repo!.save(template);
      return { success: true };
    },
  );

  ipcMain.handle(
    'templates:delete',
    async (
      _event,
      id: string,
    ): Promise<{ canceled: true } | { success: true } | { success: false; error: string }> => {
      const template = await repo!.findLatestVersion(id);
      const name = template?.name ?? id;

      const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Supprimer le template',
        message: `Supprimer « ${name} » ?`,
        detail:
          'Toutes les versions de ce template seront supprimées définitivement.\n' +
          'Les records de test associés restent conservés.',
        buttons: ['Annuler', 'Supprimer'],
        defaultId: 0,
        cancelId: 0,
      });

      if (response === 0) return { canceled: true };

      try {
        await repo!.deleteAll(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'templates:duplicate',
    async (
      _event,
      id: string,
    ): Promise<{ success: true; template: TestTemplate } | { success: false; error: string }> => {
      const original = await repo!.findLatestVersion(id);
      if (original === undefined) {
        return { success: false, error: 'Template introuvable.' };
      }

      const copy: TestTemplate = {
        ...original,
        id: randomUUID(),
        name: `Copie de ${original.name}`,
        version: 1,
        createdAt: new Date().toISOString(),
      };

      try {
        await repo!.save(copy);
        return { success: true, template: copy };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'templates:export',
    async (
      _event,
      template: TestTemplate,
    ): Promise<{ canceled: true } | { success: true; path: string } | { success: false; error: string }> => {
      const safeName = template.name.replace(/[/\\:*?"<>|]/g, '-');
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exporter le template',
        defaultPath: `${safeName}-v${template.version}.json`,
        filters: [{ name: 'Fichier JSON', extensions: ['json'] }],
      });
      if (canceled || filePath === undefined) return { canceled: true };
      try {
        await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8');
        return { success: true, path: filePath };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'templates:import-mtt',
    async (): Promise<
      | { canceled: true }
      | { canceled: false; success: true; template: TestTemplate; warnings: readonly string[] }
      | { canceled: false; success: false; error: string }
    > => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importer un template ANSUR (.mtt)',
        filters: [{ name: 'Fichiers ANSUR', extensions: ['mtt'] }],
        properties: ['openFile'],
      });

      if (canceled || filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = filePaths[0]!;

      try {
        const { template, warnings } = await parseMttFile(filePath);
        await repo!.save(template);
        return { canceled: false, success: true, template, warnings };
      } catch (err) {
        return {
          canceled: false,
          success: false,
          error: `Erreur lors de l'import : ${String(err)}`,
        };
      }
    },
  );
}
