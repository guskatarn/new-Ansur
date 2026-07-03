/**
 * Convertit un fragment RTF en texte brut.
 * Adapté aux procédures générées par ANSUR (fonttbl, colortbl, \par, \b…).
 * Ce n'est pas un convertisseur RTF général : il couvre uniquement les
 * séquences de contrôle produites par les versions d'ANSUR rencontrées en pratique.
 */
export function rtfToPlainText(rtf: string): string {
  let text = rtf.trim();

  // Supprimer l'enveloppe externe {\rtf1...} pour ne pas que la boucle
  // ci-dessous la supprime entièrement une fois les groupes internes retirés.
  if (text.startsWith('{') && text.endsWith('}')) {
    text = text.slice(1, -1);
  }

  // Supprimer les groupes imbriqués sans accolades internes en boucle.
  // Ex : {\fonttbl{\f0\fnil Verdana;}{\f1\fnil Arial;}} → {\fonttbl} → ''
  let previous = '';
  let iterations = 0;
  while (previous !== text && iterations < 20) {
    previous = text;
    text = text.replace(/\{[^{}]*\}/g, '');
    iterations++;
  }

  // Sauts de paragraphe RTF → sauts de ligne réels
  text = text.replace(/\\par\b[ ]?/g, '\n');
  text = text.replace(/\\line\b[ ]?/g, '\n');

  // Mots de contrôle RTF : \motclé suivis d'un éventuel nombre + espace optionnel
  text = text.replace(/\\[a-zA-Z]+\d*[ ]?/g, '');

  // Accolades et backslash résiduels
  text = text.replace(/[{}\\]/g, '');

  // Normaliser chaque ligne et supprimer les lignes vides
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  return lines.join('\n');
}
