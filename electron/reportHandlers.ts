import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';

export function registerReportHandlers(): void {
  ipcMain.handle(
    'report:save-as-pdf',
    async (
      _event,
      htmlContent: string,
    ): Promise<
      | { canceled: true }
      | { success: true; path: string }
      | { success: false; error: string }
    > => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Enregistrer le rapport PDF',
        defaultPath: 'rapport-de-test.pdf',
        filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
      });

      if (canceled || filePath === undefined) {
        return { canceled: true };
      }

      const printWindow = new BrowserWindow({ show: false });
      try {
        await printWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
        );
        const pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            marginType: 'custom',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          } as unknown as Electron.PrintToPDFOptions['margins'],
        });
        await fs.writeFile(filePath, pdfBuffer);
        return { success: true, path: filePath };
      } catch (err) {
        return { success: false, error: String(err) };
      } finally {
        printWindow.destroy();
      }
    },
  );
}
