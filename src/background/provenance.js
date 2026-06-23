// Dependency-free provenance pre-filter.
//
// Scans the leading bytes of an image for *declared* AI markers. This is a fast
// triage, NOT a cryptographic C2PA verification — full Content Credentials
// validation needs the c2pa WASM SDK and signature checks. Here we just look
// for the standardized text markers that live in EXIF/XMP/JUMBF:
//
//   • IPTC DigitalSourceType  — the standard "how was this made" vocabulary
//   • C2PA manifest markers    — presence of Content Credentials
//   • Known AI tool software tags
//
// Verdicts (most → least specific):
//   ai-generated         declared generative AI
//   ai-edited            composite / edited with generative AI
//   ai-software          stamped by a known AI image tool
//   content-credentials  has C2PA provenance (not necessarily AI)
//   none

// NOTE: the composite token contains the generated token as a substring, so
// EDITED must be tested before GENERATED. Plain `algorithmicMedia` (procedural
// / CGI, not trained on samples) is intentionally excluded — it isn't genAI.
const EDITED = ['compositewithtrainedalgorithmicmedia', 'compositesynthetic'];
const GENERATED = ['trainedalgorithmicmedia'];
const C2PA = ['c2pa.', 'claim_generator', 'urn:c2pa', 'contentcredentials', 'content credentials'];

// Matched against EXIF "Software" / XMP "CreatorTool" text.
const AI_SOFTWARE = [
  'dall-e', 'dall·e', 'dalle', 'midjourney', 'stable diffusion', 'stablediffusion',
  'adobe firefly', 'firefly', 'dreamstudio', 'novelai', 'leonardo.ai', 'imagen',
  'ideogram', 'flux.1', 'black forest labs', 'gemini', 'grok', 'recraft', 'playground v',
];

function decode(buffer) {
  // Latin1 keeps every byte 1:1, which is all we need for ASCII marker search.
  return new TextDecoder('latin1').decode(buffer).toLowerCase();
}

function hit(verdict, source) {
  return { verdict, source };
}

export function parseProvenance(buffer) {
  if (!buffer || !buffer.byteLength) return hit('none', '');
  const text = decode(buffer);

  if (EDITED.some((m) => text.includes(m))) return hit('ai-edited', 'IPTC DigitalSourceType');
  if (GENERATED.some((m) => text.includes(m))) return hit('ai-generated', 'IPTC DigitalSourceType');

  const sw = AI_SOFTWARE.find((s) => text.includes(s));
  if (sw) return hit('ai-software', `metadata: ${sw}`);

  if (C2PA.some((m) => text.includes(m))) return hit('content-credentials', 'C2PA manifest');

  return hit('none', '');
}
