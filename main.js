import fs from 'node:fs/promises';
import path from 'node:path';

const INDEX_PATH = './data/index.json';
const DIST_DIR = 'dist';
const CSS_FILENAME = 'styles.css';

/**
 * Les skrá og skilar gögnum eða null.
 * @param {string} filePath Skráin sem á að lesa
 * @returns {Promise<unknown | null>} Les skrá úr `filePath` og skilar innihaldi. Skilar `null` ef villa kom upp.
 */
async function readJson(filePath) {
  console.log('starting to read', filePath);
  let data;
  try {
    data = await fs.readFile(path.resolve(filePath), 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    return parsed;
  } catch (error) {
    console.error('error parsing data as json');
    return null;
  }
}

// þannig að string er sýnt sem texti
function hreinsaHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 1 svar bara
function teljaRéttaSvar(spurning) {
  return spurning.answers.reduce((acc, svar) => acc + (svar.correct ? 1 : 0), 0);
}

// spurning má 
function spurningErGild(spurning, htmlFilePath, index) {
  if (!spurning || typeof spurning !== 'object' || typeof spurning.question !== 'string' || !Array.isArray(spurning.answers) ) {
    console.error(`Spurning ${index} í ${htmlFilePath} er ógild.`);
    return false;
  }
  for (let [i, svar] of spurning.answers.entries()) {
    if (!svar || typeof svar !== 'object' ||
        typeof svar.answer !== 'string' ||
        typeof svar.correct !== 'boolean') {
      return false;
    }
  }
  if (teljaRéttaSvar(spurning) !== 1) {
    return false;
  }
  return true;
}

// htmlFilePath má 
function vinnsluSpurningar(gögn, htmlFilePath) {
  if (typeof gögn !== 'object' || gögn === null || typeof gögn.title !== 'string' || !Array.isArray(gögn.questions)) {
    console.error(`${htmlFilePath} er ógild.`);
    return [];
  }
  return gögn.questions.filter((spurning, i) => spurningErGild(spurning, htmlFilePath, i));
}

function fáHtmlNafn(htmlFilePath) {
  return `${path.basename(htmlFilePath, '.json')}.html`;
}



/**
 * Skrifa HTML fyrir yfirlit í index.html
 * @param {any} data Gögn til að skrifa
 * @returns {Promise<void>}
 */
// index.html
async function writeHtml(flokkar) {
  const tenglar = flokkar
    .map(flokkur => `<li><a href="${fáHtmlNafn(flokkur.skra)}">${hreinsaHTML(flokkur.title)}</a></li>`)
    .join('\n');
  const htmlContent = `
<!doctype html>
<html lang="is">
<head>
  <meta charset="utf-8">
  <title>spurningaflokkar</title>
  <link rel="stylesheet" href="${CSS_FILENAME}">
</head>
<body>
  <header><h1>Spurningaflokkar</h1></header>
  <main>
    <p>Veldu spurningaflokk til að svara forritunarspurningum</p>
    <ul>
      ${tenglar}
    </ul>
  </main>
</body>
</html>
`;
  const htmlFilePath = path.join(DIST_DIR, 'index.html');
  await fs.mkdir(path.dirname(htmlFilePath), { recursive: true });
  await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
  console.log(`index.html gerð`);
}

// hin html
async function hinHTML(gögn, indexData) {
  const spurningar = gögn.questions.map((spurning, i) => {
    const svörin = spurning.answers
      .map(svar =>
        `<li>
          <label>
            <input type="radio" name="q${i}" data-correct="${svar.correct}">
            ${hreinsaHTML(svar.answer)}
          </label>
        </li>`
      ).join('\n');
    return `
<div class="spurning" id="spurning-${i}">
  <p>${hreinsaHTML(spurning.question)}</p>
  <ul>
    ${svörin}
  </ul>
  <button type="button" onclick="skoðaSvar(${i})">Skoða svar</button>
  <span id="niðurstaða-${i}"></span>
</div>
`;
  }).join('\n');
  
  const htmlContent = `
<!doctype html>
<html lang="is">
<head>
  <meta charset="utf-8">
  <title>${hreinsaHTML(indexData.title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>${hreinsaHTML(gögn.title)}</h1></header>
  <main>
    ${spurningar}
  </main>
  <footer><p><a href="index.html">Til baka</a></p></footer>
  <script>
    function skoðaSvar(i) {
      const svar = document.querySelector('input[name="q' + i + '"]:checked');
      const nið = document.getElementById('niðurstaða-' + i);
      if (!svar) {
        nið.textContent = "Veldu svar.";
        return;
      }
      nið.textContent = svar.dataset.correct === "true" ? "Rétt!" : "Rangt!";
    }
  </script>
</body>
</html>
`;
const htmlFilePath = path.join(DIST_DIR, fáHtmlNafn(indexData.file));
  await fs.mkdir(path.dirname(htmlFilePath), { recursive: true });
  try {
    await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
    console.log(`HTML skrifað í ${htmlFilePath}`);
  } catch (error) {
    console.error(`Villa við að skrifa HTML: ${error.message}`);
  }
}

/**
 * Keyrir forritið okkar:
 * 1. Sækir gögn
 * 2. Staðfestir gögn (validation)
 * 3. Skrifar út HTML
 */
async function main() {
  const indexData = await readJson(INDEX_PATH);
  if (!indexData || !Array.isArray(indexData)) {
    console.error('index.json er ógild');
    return;
  }
  const flokkar = [];
  for (const item of indexData) {
    if (typeof item.title !== 'string' || typeof item.file !== 'string') {
      console.error(`villa hér: ${JSON.stringify(item)}`);
      continue;
    }
    const gögn = await readJson(path.join('data', item.file));
    if (!gögn) {
      console.error(`Gat ekki lesið ${item.file}`);
      continue;
    }
    const gildarSpurningar = vinnsluSpurningar(gögn, item.file);
    if (gildarSpurningar.length === 0) {
      console.error(`Engar gildar spurningar í ${item.file}`);
      continue;
    }
    flokkar.push({ title: item.title, skra: item.file, questions: gildarSpurningar, ...gögn });
    await hinHTML({ title: gögn.title, questions: gildarSpurningar }, item);
  }
  await writeHtml(flokkar);
  console.log('tilbúið!');
}

main();

export { hreinsaHTML, teljaRéttaSvar };