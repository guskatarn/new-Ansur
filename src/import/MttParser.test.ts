import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMttFile, parseMttXml } from './MttParser.js';
import { rtfToPlainText } from './rtfToPlainText.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_VDE = path.join(__dirname, '__fixtures__', 'VDE 751.1 - CL2.mtt');

// ─── rtfToPlainText ───────────────────────────────────────────────────────────

describe('rtfToPlainText', () => {
  it('extrait le texte brut depuis un RTF ANSUR typique', () => {
    const rtf =
      String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0\fnil\fcharset0 Verdana;}{\f1\fnil\fcharset0 MS Sans Serif;}}` +
      '\n' +
      String.raw`{\colortbl ;\red0\green0\blue0;}` +
      '\n' +
      String.raw`\viewkind4\uc1\pard\cf1\lang1033\f0\fs20 (1) Connect the DUT.` +
      '\n' +
      String.raw`\par (2) Click \b Start Test\b0  to perform.` +
      '\n' +
      String.raw`\par }`;

    const result = rtfToPlainText(rtf);

    expect(result).toContain('(1) Connect the DUT.');
    expect(result).toContain('(2) Click');
    expect(result).toContain('Start Test');
    // Aucun résidu RTF
    expect(result).not.toMatch(/\\/);
    expect(result).not.toMatch(/[{}]/);
  });

  it('retourne une chaîne vide pour un RTF sans contenu textuel', () => {
    const rtf =
      String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0\fnil\fcharset0 MS Sans Serif;}}` +
      '\n' +
      String.raw`\viewkind4\uc1\pard\lang1033\f0\fs24 ` +
      '\n' +
      String.raw`\par }`;

    expect(rtfToPlainText(rtf)).toBe('');
  });
});

// ─── parseMttXml ─────────────────────────────────────────────────────────────

describe('parseMttXml', () => {
  it("lève une erreur explicite si le fichier n'est pas un template ANSUR", () => {
    expect(() => parseMttXml('<root/>', 'test.xml')).toThrow(/template ANSUR/i);
  });

  it("lève une erreur si METRONFile[@Type] n'est pas Template", () => {
    const xml = `<?xml version="1.0"?><METRONFile Type="Record"><Template Name="X"/></METRONFile>`;
    expect(() => parseMttXml(xml, 'test.mtt')).toThrow(/template ANSUR/i);
  });
});

// ─── parseMttFile — fichier réel VDE 751.1 CL2 ───────────────────────────────

describe('parseMttFile (VDE 751.1 - CL2)', () => {
  it("parse le fichier fixture sans lever d'erreur", async () => {
    const { template, warnings } = await parseMttFile(FIXTURE_VDE);
    expect(template).toBeDefined();
    // Aide au débogage : affiche le nombre d'éléments et les éventuels avertissements
    console.info(`Éléments : ${template.elements.length}, avertissements : ${warnings.length}`);
    warnings.forEach((w) => console.info(' ⚠', w));
  });

  it('extrait le nom du template sans extension .mtt', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    expect(template.name).toBe('VDE 751.1 - CL2');
  });

  it('génère exactement 21 éléments de test', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    expect(template.elements).toHaveLength(21);
  });

  it('mappe correctement un élément avec limite min (Insulation Resistance)', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    const el = template.elements.find((e) => e.id === 'ESA620:1010');
    expect(el).toBeDefined();
    expect(el!.label).toBe('Insulation Resistance > Mains to Protective Earth');
    expect(el!.instrumentCommandId).toBe('ESA620:1010');
    expect(el!.limit).toEqual({ kind: 'numeric', unit: 'MOhm', min: 7 });
  });

  it('mappe correctement un élément à limite max (Live to Neutral sans valeur)', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    const el = template.elements.find((e) => e.id === 'ESA620:210');
    expect(el).toBeDefined();
    expect(el!.label).toBe('Mains Voltage > Live to Neutral');
    // Limite sans valeur explicite : unité conservée, pas de min/max
    expect(el!.limit).toEqual({ kind: 'numeric', unit: 'V' });
  });

  it('éclate les limites B/BF/CF en éléments distincts', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);

    const elB = template.elements.find((e) => e.id === 'ESA620:1310_B');
    const elBF = template.elements.find((e) => e.id === 'ESA620:1310_BF');
    const elCF = template.elements.find((e) => e.id === 'ESA620:1310_CF');

    expect(elB).toBeDefined();
    expect(elBF).toBeDefined();
    expect(elCF).toBeDefined();

    expect(elB!.label).toBe('Patient Leakage Current > Normal Condition [B]');
    expect(elB!.instrumentCommandId).toBe('ESA620:1310');
    expect(elB!.limit).toEqual({ kind: 'numeric', unit: 'uA', max: 100 });

    expect(elCF!.limit).toEqual({ kind: 'numeric', unit: 'uA', max: 10 });
  });

  it('lève des avertissements pour les limites sans valeur explicite', async () => {
    const { warnings } = await parseMttFile(FIXTURE_VDE);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/sans valeur explicite/i);
  });

  it('toutes les commandes instrument ont le préfixe ESA620:', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    for (const el of template.elements) {
      expect(el.instrumentCommandId).toMatch(/^ESA620:/);
    }
  });

  it('tous les éléments ont kind = measurement', async () => {
    const { template } = await parseMttFile(FIXTURE_VDE);
    for (const el of template.elements) {
      expect(el.kind).toBe('measurement');
    }
  });
});
