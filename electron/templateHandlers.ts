import { dialog, ipcMain } from 'electron';
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
