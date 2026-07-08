import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), '../docs/su');
const OUTPUT_FILE = path.join(process.cwd(), 'su-seed-data.json');

const files = [
  { file: 'students.md', category: 'Student' },
  { file: 'professors.md', category: 'Professor' },
  { file: 'janitors.md', category: 'Janitor' },
  { file: 'police.md', category: 'Campus Police' },
  { file: 'club-directors.md', category: 'Club Director' },
  { file: 'librarian-cousler.md', category: 'Librarian/Counselor' },
];

const creators = [];

for (const { file, category } of files) {
  const filePath = path.join(DOCS_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Ignore lines that are exactly the category name or 'Guidance Counselors' etc
    if (
      line.toLowerCase() === category.toLowerCase() ||
      line.toLowerCase() === 'guidance counselor' ||
      line.toLowerCase() === 'guidance counselors' ||
      line.toLowerCase() === 'librarian'
    ) {
      continue;
    }

    if (line.startsWith('@')) {
      creators.push({
        username: line.substring(1),
        platform: 'twitch', // Defaulting to twitch
        category,
      });
    } else {
      // Just in case there's a username without @
      creators.push({
        username: line,
        platform: 'twitch',
        category,
      });
    }
  }
}

// Remove duplicates just in case
const uniqueCreators = [];
const seen = new Set();
for (const c of creators) {
  if (!seen.has(c.username.toLowerCase())) {
    seen.add(c.username.toLowerCase());
    uniqueCreators.push(c);
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueCreators, null, 2));
console.log(`Successfully parsed ${uniqueCreators.length} creators to ${OUTPUT_FILE}`);
