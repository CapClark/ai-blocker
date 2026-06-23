import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseProvenance } from '../src/background/provenance.js';

const here = dirname(fileURLToPath(import.meta.url));
const buf = (s) => new TextEncoder().encode(s).buffer;
const img = (name) => {
  const b = readFileSync(join(here, 'images', name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const verdict = (input) => parseProvenance(input).verdict;

test('synthetic markers map to verdicts', () => {
  assert.equal(verdict(buf('DigitalSourceType=trainedAlgorithmicMedia')), 'ai-generated');
  assert.equal(verdict(buf('...compositeWithTrainedAlgorithmicMedia...')), 'ai-edited');
  assert.equal(verdict(buf('Software: Midjourney v6')), 'ai-software');
  assert.equal(verdict(buf('jumbf c2pa.actions claim_generator')), 'content-credentials');
  assert.equal(verdict(buf('Adobe Photoshop Lightroom 13.0')), 'none');
  assert.equal(verdict(buf('')), 'none');
});

test('composite token is not misread as generated', () => {
  // "compositeWith...trainedAlgorithmicMedia" contains the generated token, so
  // EDITED must be matched first. This guards that ordering.
  assert.equal(verdict(buf('x compositeWithTrainedAlgorithmicMedia x')), 'ai-edited');
});

test('algorithmicMedia (procedural/CGI) is not flagged as AI', () => {
  assert.equal(verdict(buf('DigitalSourceType=algorithmicMedia')), 'none');
});

test('PNG fixtures (tEXt/XMP chunks)', () => {
  assert.equal(verdict(img('ai-generated.png')), 'ai-generated');
  assert.equal(verdict(img('ai-edited.png')), 'ai-edited');
  assert.equal(verdict(img('ai-software.png')), 'ai-software');
  assert.equal(verdict(img('content-credentials.png')), 'content-credentials');
  assert.equal(verdict(img('plain-photo.png')), 'none');
});

test('JPEG fixtures (EXIF + XMP APP1 segments)', () => {
  assert.equal(verdict(img('ai-generated.jpg')), 'ai-generated');
  assert.equal(verdict(img('ai-software.jpg')), 'ai-software');
});
