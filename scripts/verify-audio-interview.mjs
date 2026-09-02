import fs from 'node:fs';

const source = fs.readFileSync('src/main-v2.jsx', 'utf8');
const required = [
  ['speech synthesis API', /speechSynthesis/],
  ['Indian English voice locale', /\b(?:u|utterance)\.lang\s*=\s*['"]en-IN['"]/],
  ['cancel previous question audio', /window\.speechSynthesis\?\.cancel\(\)/],
  ['question accessibility announcement', /aria-live\s*=\s*["']polite["']/],
  ['speech cleanup on unmount', /window\.speechSynthesis\?\.cancel\(\)/],
];

for (const [label, marker] of required) {
  if (!marker.test(source)) throw new Error(`Audio interview regression: missing ${label}`);
}

const voiceStart = source.indexOf('function VoiceInterview');
const voiceEnd = source.indexOf('function Feedback', voiceStart);
if (voiceStart < 0 || voiceEnd < 0) throw new Error('Audio interview regression: VoiceInterview component not found');
const component = source.slice(voiceStart, voiceEnd);
if (!/SpeechSynthesisUtterance\(question\)/.test(component)) throw new Error('Audio interview regression: questions are no longer spoken');
if (!component.includes('rec.current?.abort()') || !/window\.speechSynthesis\?\.cancel\(\)/.test(component)) throw new Error('Audio interview regression: interview cleanup effect missing');

console.log('Audio interview contract verified: speech, Indian English locale, accessibility and cleanup are present.');
