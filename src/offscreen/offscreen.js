// Offscreen document — the DOM/WebGPU-capable context for on-device pixel
// classification. Reached from the service worker via "Verify image".
//
// TODO: load a quantized AI-image classifier (Transformers.js / ONNX Runtime
// Web) on the WebGPU backend, then here:
//   const blob = await (await fetch(msg.url)).blob();
//   const bitmap = await createImageBitmap(blob);
//   const score = await model(bitmap);   // 0..1 likelihood
//   sendResponse({ label: score >= 0.5 ? 'ai' : 'real', score });
// Until a model is wired in, return a clearly-labeled stub so the seam works.
import { MSG } from '../shared/settings.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== MSG.CLASSIFY_IMAGE) return false;
  sendResponse({ label: 'unknown', score: 0, stub: true });
  return true;
});
