# ANSUR Replacement — scaffold (Phase 1)

Application desktop Electron + React + TypeScript destinée à remplacer ANSUR
(Fluke Biomedical) pour l'automatisation de tests d'équipements biomédicaux.

## Structure

```
electron/               process principal (fenêtre, IPC, génération PDF native)
  main.ts
  preload.ts
src/
  domain/                moteur de test, indépendant de l'UI et du matériel
    types.ts             modèle de domaine (Template, Sequence, Record, Limits...)
    TestEngine.ts
    TestEngine.test.ts
  instruments/            couche d'abstraction instrument
    InstrumentDriver.ts   interface commune à tous les drivers
    MockInstrumentDriver.ts
  persistence/             stockage fichier JSON (aucune base de données), repositories
    FileStore.ts           primitives bas niveau (écriture atomique, lecture, sanitisation)
    DataStore.ts           résolution/création de l'arborescence de dossiers
    AuditLog.ts             journal d'audit append-only (JSONL)
    TemplateRepository.ts
    SequenceRepository.ts
    TestRecordRepository.ts
  ui/                       React (renderer)
    App.tsx
    main.tsx
```

## Démarrage

```bash
npm install
npm run test          # tests du moteur de test (Vitest)
npm run build:electron
npm run dev            # lance Vite (renderer) - à combiner avec electron:dev
```

Note : ce scaffold n'a pas encore été `npm install`-é ni testé dans cet
environnement (pas d'accès à un vrai poste Windows avec port série ici) —
à vérifier de ton côté avant la suite.

## Principes structurants

- **Offline-first**, aucune dépendance cloud.
- **Aucune base de données** : toute la persistance est en fichiers JSON sur
  le disque de l'utilisateur, sous `Documents/ANSUR Replacement/data/` par
  défaut :

  ```
  data/
    templates/<templateId>/v<version>.json
    sequences/<sequenceId>.json
    records/<numeroSerieDUT>/<recordId>.json   ← un dossier par machine testée
    audit-log.jsonl
  ```

  Bénéfice secondaire : plus de dépendance native (`better-sqlite3`), donc
  plus de compilation `node-gyp` requise à l'installation.
- **Records immuables** : `FileTestRecordRepository.save()` refuse d'écraser
  un fichier existant. Toute correction se fait par un nouveau record, jamais
  par mutation. C'est la base de la piste d'audit (logique 21 CFR Part 11).
- **Couche instrument découplée** : ajouter un instrument = écrire une classe
  qui implémente `InstrumentDriver`, sans toucher au moteur ni à l'UI.
- **PDF sans dépendance supplémentaire** : génération via
  `webContents.printToPDF()` (Electron embarque déjà Chromium), pas de
  Puppeteer/Playwright.

## Prochaines phases (validées avec toi)

1. ✅ Scaffold (ce livrable)
2. Modèle de domaine + repositories SQLite — **fait dans ce scaffold**,
   à valider / affiner ensemble
3. Parser `.mtt` ANSUR (XML → domaine), prioritaire selon tes retours
4. Drivers réels : ESA620, Impulse 6000D/7000DP, QA-ES (documentation de
   protocole officielle Fluke déjà identifiée) — IDA-4 à creuser, IDA-5 et
   QA-IDS en attente de documentation
5. Éditeur de template (UI)
6. Exécuteur de test guidé (UI)
7. Génération de rapport PDF depuis un `TestRecord`

## Décisions déjà actées

- UI en français uniquement
- Usage mono-poste (pas de gestion de concurrence multi-utilisateur)
- Import des fichiers `.mtt`/`.mts`/`.mtr` prioritaire
- QA-90 MKII et QA-45 exclus (en cours de remplacement, pas de documentation
  de protocole disponible)
