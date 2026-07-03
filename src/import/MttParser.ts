/**
 * Parser de fichiers .mtt ANSUR (format XML METRONFile).
 *
 * Stratégie d'aplatissement de l'arbre TestElement :
 *  - Les nœuds "Auto Sequence" (racine) sont ignorés, on descend sans ajouter au chemin.
 *  - Les nœuds groupe (ont des enfants TestElement) contribuent leur nom au préfixe de label.
 *  - Les nœuds feuilles (pas d'enfants) génèrent un ou plusieurs TestElement selon le nombre
 *    de limites avec valeur explicite (une limite → un élément, N limites → N éléments).
 */

import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NumericLimit, TestElement, TestTemplate } from '../domain/types.js';
import { rtfToPlainText } from './rtfToPlainText.js';

// ─── API publique ─────────────────────────────────────────────────────────────

export interface MttParseResult {
  readonly template: TestTemplate;
  /** Avertissements non-bloquants (limites sans valeur explicite, éléments ignorés…). */
  readonly warnings: readonly string[];
}

/**
 * Parse un contenu XML .mtt passé en chaîne.
 * Séparé de parseMttFile pour faciliter les tests unitaires.
 */
export function parseMttXml(xml: string, sourceFileName?: string): MttParseResult {
  const root = XML_PARSER.parse(xml) as { METRONFile?: RawMETRONFile };
  const file = root.METRONFile;

  if (file?.['@_Type'] !== 'Template') {
    throw new Error(
      `${sourceFileName ?? 'Fichier'} n'est pas un template ANSUR valide ` +
        `(METRONFile[@Type] attendu : "Template").`,
    );
  }

  // Plugin principal déclaré dans <Application> (ex. "ESA620")
  const pluginRaw = file.Application?.PlugIn;
  const pluginEntry = Array.isArray(pluginRaw) ? pluginRaw[0] : pluginRaw;
  const pluginName = pluginEntry?.['@_Name'] ?? 'UNKNOWN';

  // Nom du template sans l'extension .mtt éventuelle
  const rawName = file.Template?.['@_Name'] ?? sourceFileName ?? 'Template importé';
  const templateName = rawName.replace(/\.mtt$/i, '');

  const warnings: string[] = [];
  const rootElements = file.Template?.TemplateData?.TestElement ?? [];
  const elements = walkElements(rootElements, pluginName, [], warnings);

  const template: TestTemplate = {
    id: crypto.randomUUID(),
    name: templateName,
    version: 1,
    createdAt: new Date().toISOString(),
    elements,
  };

  return { template, warnings };
}

/** Lit un fichier .mtt depuis le disque (encodage iso8859-1) et le parse. */
export async function parseMttFile(filePath: string): Promise<MttParseResult> {
  const xml = await fs.readFile(filePath, 'latin1');
  return parseMttXml(xml, path.basename(filePath));
}

// ─── Types internes pour le XML brut ─────────────────────────────────────────

interface RawValue {
  '@_Type'?: string;       // 'Low' | 'High'
  '#text'?: number | string;
}

interface RawLimit {
  '@_Key'?: string;        // '::ST', '::B', '::BF', '::CF'…
  Unit?: string;
  Value?: RawValue[];      // toujours tableau (isArray)
}

interface RawStandard {
  Limit?: RawLimit[];      // toujours tableau (isArray)
}

interface RawExpectedResult {
  Standard?: RawStandard;
}

interface RawProcedure {
  '@_Format'?: string | number;
  '#cdata'?: string;       // contenu CDATA (cdataPropName: '#cdata')
  '#text'?: string;        // fallback si cdataPropName non supporté
}

interface RawInfo {
  Type?: string;
  Name?: string;
  Procedure?: RawProcedure;
}

interface RawPlugin {
  '@_Name'?: string;
  '@_TestID'?: number | string;
}

interface RawTestElement {
  '@_ID'?: number | string;
  PlugIn?: RawPlugin;
  Info?: RawInfo;
  ExpectedResult?: RawExpectedResult;
  TestElement?: RawTestElement[];  // enfants, toujours tableau (isArray)
}

interface RawMETRONFile {
  '@_Type'?: string;
  Application?: {
    PlugIn?: { '@_Name'?: string } | Array<{ '@_Name'?: string }>;
  };
  Template?: {
    '@_Name'?: string;
    TemplateData?: {
      TestElement?: RawTestElement[];
    };
  };
}

// ─── Instance XMLParser (réutilisée entre appels) ─────────────────────────────

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,   // "100" → 100, "True" → true dans les attributs
  cdataPropName: '#cdata',     // CDATA stocké sous la clé '#cdata'
  isArray: (name: string) => ['TestElement', 'Limit', 'Value'].includes(name),
});

// ─── Parcours récursif de l'arbre TestElement ─────────────────────────────────

function walkElements(
  elements: RawTestElement[],
  pluginName: string,
  parentPath: readonly string[],
  warnings: string[],
): TestElement[] {
  const result: TestElement[] = [];

  for (const el of elements) {
    const children = el.TestElement ?? [];
    const type = el.Info?.Type ?? '';
    const name = el.Info?.Name ?? `Élément ${String(el['@_ID'] ?? '?')}`;

    if (type === 'Auto Sequence') {
      // Conteneur global : on descend sans contribution au chemin de labels
      result.push(...walkElements(children, pluginName, [], warnings));
      continue;
    }

    if (children.length > 0) {
      // Nœud groupe : son nom préfixe les labels des feuilles enfants
      result.push(...walkElements(children, pluginName, [...parentPath, name], warnings));
      continue;
    }

    // ── Nœud feuille ──────────────────────────────────────────────────────────

    const testId = el.PlugIn?.['@_TestID'];
    if (testId === undefined || testId === '') {
      warnings.push(`Élément ID=${String(el['@_ID'] ?? '?')} ignoré : aucun TestID plugin.`);
      continue;
    }

    const commandId = `${pluginName}:${String(testId)}`;
    const labelBase = [...parentPath, name].join(' > ');
    const instructions = extractInstructions(el.Info?.Procedure);
    const limits = extractLimits(el['@_ID'], el.ExpectedResult, warnings);

    if (limits.length <= 1) {
      // Zéro ou une seule limite : un unique TestElement
      const limit = limits[0]?.limit;
      const newEl: TestElement = {
        id: commandId,
        label: labelBase,
        kind: 'measurement',
        instrumentCommandId: commandId,
        ...(limit !== undefined ? { limit } : {}),
        ...(instructions !== undefined ? { instructions } : {}),
      };
      result.push(newEl);
    } else {
      // Limites multiples (B / BF / CF…) → un TestElement par limite-clé
      for (const { key, limit } of limits) {
        const keyShort = key.replace(/^::/, '');
        const newEl: TestElement = {
          id: `${commandId}_${keyShort}`,
          label: `${labelBase} [${keyShort}]`,
          kind: 'measurement',
          instrumentCommandId: commandId,
          limit,
          ...(instructions !== undefined ? { instructions } : {}),
        };
        result.push(newEl);
      }
    }
  }

  return result;
}

// ─── Extraction des limites ───────────────────────────────────────────────────

interface ParsedLimit {
  key: string;
  limit: NumericLimit;
}

function extractLimits(
  elementId: number | string | undefined,
  expectedResult: RawExpectedResult | undefined,
  warnings: string[],
): ParsedLimit[] {
  const rawLimits = expectedResult?.Standard?.Limit ?? [];
  if (rawLimits.length === 0) return [];

  return rawLimits.map((rawLimit) => {
    const key = rawLimit['@_Key'] ?? '::?';
    const unit = rawLimit.Unit ?? '';
    const values = rawLimit.Value ?? [];

    let min: number | undefined;
    let max: number | undefined;

    for (const v of values) {
      // '#text' peut être string ou number selon la version du parser
      const n =
        typeof v['#text'] === 'number' ? v['#text'] : parseFloat(String(v['#text'] ?? ''));
      if (isNaN(n)) continue;
      if (v['@_Type'] === 'Low') min = n;
      else if (v['@_Type'] === 'High') max = n;
    }

    if (values.length === 0) {
      warnings.push(
        `Élément ID=${String(elementId ?? '?')}, limite ${key} sans valeur explicite ` +
          `(standard ANSUR interne non résolu) — unité "${unit}" conservée.`,
      );
    }

    const limit: NumericLimit = {
      kind: 'numeric',
      unit,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };

    return { key, limit };
  });
}

// ─── Extraction de la procédure RTF ──────────────────────────────────────────

function extractInstructions(procedure: RawProcedure | undefined): string | undefined {
  if (!procedure) return undefined;
  // '#cdata' si cdataPropName est supporté par la version installée, '#text' en fallback
  const raw = procedure['#cdata'] ?? procedure['#text'];
  if (!raw) return undefined;
  const text = rtfToPlainText(raw);
  return text.length > 0 ? text : undefined;
}
