// Registry of the Unit 4 generators, keyed by the fixed TOPICS ids (index.js).
import { TOPICS } from './index.js';
import { createRng } from './rng.js';
import ratio_simplest from './ratio_simplest.js';
import extended_ratio from './extended_ratio.js';
import proportion from './proportion.js';
import similar_missing_side from './similar_missing_side.js';
import similarity_proof from './similarity_proof.js';
import triangle_proportionality from './triangle_proportionality.js';
import parallel_proportional from './parallel_proportional.js';
import angle_bisector from './angle_bisector.js';

export const GENERATORS = Object.freeze({
  ratio_simplest, extended_ratio, proportion, similar_missing_side, similarity_proof,
  triangle_proportionality, parallel_proportional, angle_bisector,
});

export const TOPIC_IDS = Object.freeze(TOPICS.map((t) => t.id));

export function topicInfo(id) { return TOPICS.find((t) => t.id === id) || null; }

/** One problem: generate(topicId, difficulty 1-3, seed) -> question object (see QUESTIONS.md). */
export function generate(topicId, difficulty = 1, seed = 1) {
  const g = GENERATORS[topicId];
  if (!g) throw new Error('unknown Unit 4 topic: ' + topicId);
  const d = Math.max(1, Math.min(3, Math.round(difficulty) || 1));
  const q = g.generate(createRng(seed), d);
  q.seed = seed;
  return q;
}
