// bun scripts/deck-card.ts <deck.json>: writes card.json beside a Cell Deck (celldeck has no card export of its own).
// The headline is the number of saved views (the steps you present); the legend counts what is on the stage.
// Links open the hosted viewer with ?src=<PAGES><deck.json> (or the bare path when PAGES is unset), like the other tools' cards.
import { dirname, join } from 'node:path';

const deckPath = process.argv[2];
if (!deckPath) throw new Error('Usage: bun scripts/deck-card.ts <deck.json>');
const deck = await Bun.file(deckPath).json();
const { bubbles = [], elements = [], links = [] } = deck.scene ?? {};
const views: unknown[] = deck.views ?? [];

const url = 'https://aaronp.github.io/celldeck/?src=' + (process.env.PAGES ? process.env.PAGES + deckPath : deckPath);
const status =
  bubbles.length === 0 ? { label: 'Empty', tone: 'neutral' }
  : views.length === 0 ? { label: 'No views yet', tone: 'warn' }
  : { label: 'Ready to present', tone: 'good' };
const card = {
  version: 1,
  title: 'Overview',
  subtitle: 'Cell Deck',
  status,
  heading: { primary: String(views.length), label: views.length === 1 ? 'saved view' : 'saved views' },
  legend: [
    { id: 'bubbles', label: 'Bubbles', color: '#1F2633' },
    { id: 'elements', label: 'Elements', color: '#6E86E8' },
    { id: 'links', label: 'Links', color: '#D5DAE1' }
  ],
  report: { bubbles: bubbles.length, elements: elements.length, links: links.length },
  source: { label: deckPath, url },
  updated: new Date().toLocaleDateString('en-CA')
};
const out = join(dirname(deckPath), 'card.json');
await Bun.write(out, JSON.stringify(card, null, 2) + '\n');
console.log(`Wrote ${out}`);
