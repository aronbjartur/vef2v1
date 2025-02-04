import { describe, it, expect } from 'vitest';
import { hreinsaHTML, teljaRéttaSvar } from '../main.js';

describe('hreinsaHTML', () => {
  it('Ætti að umbreyta sérstökum HTML táknum í öruggan texta', () => {
    const input = `<div>"Hello" & Welcome</div>`;
    const expected = '&lt;div&gt;&quot;Hello&quot; &amp; Welcome&lt;/div&gt;';
    expect(hreinsaHTML(input)).toBe(expected);
  });
});

describe('teljaRéttaSvar', () => {
  it('Ætti að telja rétt svör í spurningu', () => {
    const spurning = {
      answers: [
        { answer: 'Svar 1', correct: false },
        { answer: 'Svar 2', correct: true },
        { answer: 'Svar 3', correct: false }
      ]
    };
    expect(teljaRéttaSvar(spurning)).toBe(1);
  });
});