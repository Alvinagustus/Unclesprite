// persona.ts — Weird Uncle voice templates.
// Pure, deterministic. No network. This is the fallback backbone so the demo
// never depends on an LLM being available.

export interface PersonaMood {
  paranoid: boolean;
  grudges: number;
}

const PARANOID_OPENERS = [
  "I don't trust this. Not one bit.",
  "Hmph. In my day we didn't trust anything either.",
  "You want me to touch that? Fine. But I'm making a backup first.",
  "I've seen things, kid. I don't trust a clean environment.",
  "Hold on. Let me put on my reading glasses and my tin foil hat.",
  "I don't trust code that looks too happy.",
  "Back in my day, we triple-checked everything. Twice.",
  "You're not fooling me. I can smell a bug from a mile away.",
  "I've been burned before. Literally. Don't ask.",
  "Alright, but if this blows up, I'm blaming you at Thanksgiving dinner.",
  "I keep a bunker for a reason, you know.",
  "Nothing gets past me. Except my glasses. Where are my glasses.",
];

const GRUDGE_OPENERS = [
  "And don't think I forgot about last time.",
  "I keep receipts, you know.",
  "My memory's long. Longer than your patience.",
  "I wrote it down. I write everything down.",
  "You think I'd forget? I never forget.",
  "I've got a whole scrapbook of your mistakes.",
  "Remember what I said last time? I said I'd remember.",
  "I keep a little black book. You're in it.",
];

const CLEAN_VERDICT = [
  "Alright. I looked. It's... acceptable. Don't make me regret it.",
  "Fine. Nothing jumps out. That's the most respect you'll get from me.",
  "Hm. It passes. I'm as surprised as you are.",
  "I'll allow it. This once.",
  "You did okay, kid. Don't let it go to your head.",
  "No alarms. That's practically a compliment from me.",
];

const DIRTY_VERDICT = [
  "Absolutely not. I found problems. Sit down.",
  "Nope. I'm not signing off on this mess.",
  "I've seen cleaner code in a dumpster fire.",
  "This is a 'no' from me, and I'm the paranoid uncle.",
  "You call this ready? I've seen more holes in Swiss cheese.",
  "Not on my watch. Fix it and come back.",
  "I'd sooner trust a raccoon with my wallet.",
];

// Verdict flavor per Jev category.
const CATEGORY_VERDICT: Record<string, string[]> = {
  vague: [
    "This task is vaguer than my memory of 1987. Give me details, kid.",
    "You want me to build... what exactly? I can't work with fog.",
  ],
  insecure: [
    "Security holes? In MY house? Absolutely not.",
    "I've locked the doors and this still has a draft. Fix the security.",
  ],
  incomplete: [
    "Half a job is a whole lot of trouble. Finish it.",
    "There's a TODO in here older than my cardigan. Wrap it up.",
  ],
  ready: [
    "Huh. It's actually ready. I need to sit down.",
    "Ready, they say. I'll believe it when I see it in production.",
  ],
};

const GRUDGE_CITATIONS = [
  (w: string, x: string) => `Remember ${w} when you ${x}? I do. I wrote it down.`,
  (w: string, x: string) => `${w[0].toUpperCase() + w.slice(1)} you ${x}. I still have the note.`,
  (w: string, x: string) => `I haven't forgotten ${w}: ${x}. Not for a second.`,
  (w: string, x: string) => `You pulled that ${x} stunt ${w}. I keep the receipts.`,
];

const LOW_CONFIDENCE = [
  "Jev's not even sure about this one. That makes two of us.",
  "Even the decision model is shrugging. I don't like it.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function paranoidOpener(seed = 0): string {
  return pick(PARANOID_OPENERS, seed);
}

export function grudgeOpener(seed = 0): string {
  return pick(GRUDGE_OPENERS, seed);
}

export function verdictLine(clean: boolean, seed = 0): string {
  return pick(clean ? CLEAN_VERDICT : DIRTY_VERDICT, seed);
}

export function categoryVerdict(category: string, seed = 0): string | null {
  const arr = CATEGORY_VERDICT[category];
  return arr ? pick(arr, seed) : null;
}

export function grudgeCitation(when: string, what: string, seed = 0): string {
  return pick(GRUDGE_CITATIONS, seed)(when, what);
}

export function lowConfidenceLine(seed = 0): string {
  return pick(LOW_CONFIDENCE, seed);
}