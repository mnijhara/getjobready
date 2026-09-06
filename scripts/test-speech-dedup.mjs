function cleanRepeatedPhrases(str) {
  if (!str) return '';
  let text = str.replace(/[ \t]+/g, ' ').trim();
  let words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return text;

  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    // Check for exact repeating n-grams: w[start..start+len-1] === w[start+len..start+2len-1]
    for (let len = Math.floor(words.length / 2); len >= 1; len--) {
      for (let start = 0; start <= words.length - 2 * len; start++) {
        let match = true;
        for (let i = 0; i < len; i++) {
          if (words[start + i].toLowerCase() !== words[start + len + i].toLowerCase()) {
            match = false;
            break;
          }
        }
        if (match) {
          words.splice(start, len);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return words.join(' ');
}

function combineSpeechResults(results) {
  if (!results || !results.length) return '';

  const cleanSegments = [];
  for (let i = 0; i < results.length; i++) {
    const raw = (results[i].transcript || results[i].text || '').trim();
    if (!raw) continue;
    cleanSegments.push({
      text: raw,
      isFinal: !!results[i].isFinal
    });
  }

  if (!cleanSegments.length) return '';

  let merged = [];
  for (const seg of cleanSegments) {
    const text = seg.text.trim();
    if (!text) continue;
    if (merged.length === 0) {
      merged.push(text);
      continue;
    }

    const last = merged[merged.length - 1];
    const lastLower = last.toLowerCase();
    const currLower = text.toLowerCase();

    // 1. Exact duplicate
    if (lastLower === currLower) {
      continue;
    }

    // 2. Current segment is an extension of last segment (Mobile Chrome prefix accumulation!)
    if (currLower.startsWith(lastLower)) {
      merged[merged.length - 1] = text;
      continue;
    }

    // 3. Last segment is already a superset of current segment
    if (lastLower.startsWith(currLower)) {
      continue;
    }

    // 4. Overlapping words between end of last and start of curr
    const lastWords = last.split(/\s+/);
    const currWords = text.split(/\s+/);
    let overlapLen = 0;
    const maxOverlap = Math.min(lastWords.length, currWords.length);

    for (let k = maxOverlap; k >= 1; k--) {
      const lastSlice = lastWords.slice(-k).map(w => w.toLowerCase()).join(' ');
      const currSlice = currWords.slice(0, k).map(w => w.toLowerCase()).join(' ');
      if (lastSlice === currSlice) {
        overlapLen = k;
        break;
      }
    }

    if (overlapLen > 0) {
      const nonOverlapping = currWords.slice(overlapLen).join(' ');
      if (nonOverlapping) {
        merged[merged.length - 1] = last + ' ' + nonOverlapping;
      }
    } else {
      merged.push(text);
    }
  }

  let fullText = merged.join(' ').replace(/[ \t]+/g, ' ').trim();
  return cleanRepeatedPhrases(fullText);
}

// Tests:
console.log('Test 1 (Mobile incremental):', combineSpeechResults([
  { text: 'I', isFinal: true },
  { text: 'I did', isFinal: true },
  { text: 'I did a', isFinal: true },
  { text: 'I did a good job', isFinal: true }
]));

console.log('Test 2 (Mobile 5-step incremental):', combineSpeechResults([
  { text: 'I', isFinal: true },
  { text: 'I did', isFinal: true },
  { text: 'I did a', isFinal: true },
  { text: 'I did a good', isFinal: true },
  { text: 'I did a good job', isFinal: true }
]));

console.log('Test 3 (Desktop split):', combineSpeechResults([
  { text: 'I did a', isFinal: true },
  { text: 'good job', isFinal: true }
]));

console.log('Test 4 (Word overlap):', combineSpeechResults([
  { text: 'I worked on the sync engine', isFinal: true },
  { text: 'sync engine using WebSockets', isFinal: true }
]));

console.log('Test 5 (Direct repetitive string):', cleanRepeatedPhrases('I I did I did a I did a good job'));
console.log('Test 6 (Direct 5-step repetitive string):', cleanRepeatedPhrases('I I did I did a I did a good I did a good job'));
