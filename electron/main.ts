import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { initDataStore, type DataStorePaths } from '../src/persistence/DataStore.js';
import { registerAuditHandlers } from './auditHandlers.js';
import { registerInstrumentHandlers } from './instrumentHandlers.js';
import { registerRecordHandlers } from './recordHandlers.js';
import { registerReportHandlers } from './reportHandlers.js';
import { registerTemplateHandlers } from './templateHandlers.js';

/**
 * Process principal Electron.
 *
 * Responsabilités :
 *  - créer la fenêtre principale (le moteur de rendu = notre UI React)
 *  - exposer les opérations "sensibles" (fichiers de données, port série,
 *    génération PDF) via IPC, jamais directement dans le renderer
 *    (contextIsolation activée)
 *  - générer les rapports PDF via webContents.printToPDF(), sans dépendance
 *    supplémentaire type Puppeteer/Playwright (Electron embarque déjà Chromium)
 *
 * Persistance : aucune base de données. Tout est stocké en fichiers JSON
 * sous un dossier dédié dans les documents de l'utilisateur (voir
 * DataStore.ts). C'est ce dossier qu'il faudra sauvegarder/archiver.
 */

let mainWindow: BrowserWindow | null = null;
let dataStorePaths: DataStorePaths | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    // Mode développement : on pointe vers le serveur Vite
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Mode production : fichiers statiques buildés
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  // Dossier de données par défaut : Documents/ANSUR Replacement/data.
  // Rendu configurable dans une phase ultérieure (réglages de l'app) si besoin.
  const dataRoot = path.join(app.getPath('documents'), 'ANSUR Replacement', 'data');
  dataStorePaths = await initDataStore(dataRoot);

  registerInstrumentHandlers();
  registerTemplateHandlers(dataStorePaths.templatesDir);
  registerRecordHandlers(dataStorePaths.sequencesDir, dataStorePaths.recordsDir, dataStorePaths.auditLogPath);
  registerReportHandlers();
  registerAuditHandlers(dataStorePaths.auditLogPath);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('data-store:get-paths', () => dataStorePaths);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Génère un PDF à partir d'un fragment HTML (le rapport de test) en utilisant
 * une fenêtre Electron invisible dédiée. On ne réutilise pas mainWindow pour
 * ne pas perturber l'UI pendant la génération.
 */
ipcMain.handle('report:generate-pdf', async (_event, htmlContent: string, outputPath: string) => {
  const printWindow = new BrowserWindow({ show: false });
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } as unknown as Electron.PrintToPDFOptions['margins'],
    });
    await fs.writeFile(outputPath, pdfBuffer);
    return { success: true, path: outputPath };
  } finally {
    printWindow.destroy();
  }
});

// D'autres handlers IPC (templates, records, ports série disponibles) seront
// ajoutés au fur et à mesure des phases suivantes (persistance, drivers réels).
