// Extract text from repository-owned FAQ fragments, not arbitrary HTML documents.
// Track nested delimiters so removing one tag cannot expose another tag. Discard
// an unterminated tag through EOF; entities are decoded once, after extraction.
export function plainText(html) {
  const text = [];
  let depth = 0;
  for (const character of html) {
    if (character === "<") depth++;
    else if (character === ">" && depth > 0) depth--;
    else if (depth === 0) text.push(character);
  }
  return text.join("").replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g,
    (_match, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: "\u00a0" })[entity]).replace(/\s+/g, " ").trim();
}

// Text extraction is not output encoding. Always escape '<' when embedding JSON
// in a script element, including literal markup produced by entity decoding.
export const scriptJson = value => JSON.stringify(value).replace(/</g, "\\u003c");
