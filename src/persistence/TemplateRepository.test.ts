import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileTemplateRepository } from './TemplateRepository.js';
import type { TestTemplate } from '../domain/types.js';

function buildTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
  return {
    id: 'tpl-esa620-basique',
    name: 'Sécurité électrique - basique',
    version: 1,
    createdAt: new Date().toISOString(),
    elements: [],
    ...overrides,
  };
}

describe('FileTemplateRepository', () => {
  let dir: string;
  let repo: FileTemplateRepository;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ansur-templates-'));
    repo = new FileTemplateRepository(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sauvegarde et relit un template par id + version', async () => {
    await repo.save(buildTemplate());
    const found = await repo.findByIdAndVersion('tpl-esa620-basique', 1);
    expect(found?.name).toBe('Sécurité électrique - basique');
  });

  it('retourne la version la plus récente sans avoir à la préciser', async () => {
    await repo.save(buildTemplate({ version: 1 }));
    await repo.save(buildTemplate({ version: 2, name: 'v2 modifiée' }));
    const latest = await repo.findLatestVersion('tpl-esa620-basique');
    expect(latest?.version).toBe(2);
    expect(latest?.name).toBe('v2 modifiée');

    // l'ancienne version reste lisible : versionnage additif, pas d'écrasement
    const v1 = await repo.findByIdAndVersion('tpl-esa620-basique', 1);
    expect(v1?.name).toBe('Sécurité électrique - basique');
  });

  it("retourne undefined pour un template qui n'existe pas", async () => {
    const found = await repo.findByIdAndVersion('inconnu', 1);
    expect(found).toBeUndefined();
  });

  it('liste tous les templates (dernière version de chacun)', async () => {
    await repo.save(buildTemplate({ id: 'tpl-a', name: 'A' }));
    await repo.save(buildTemplate({ id: 'tpl-b', name: 'B' }));
    const all = await repo.listAll();
    expect(all.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });
});
