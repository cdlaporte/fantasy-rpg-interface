// Unit 4: Similar Figures (Geometry C). Owned by package B, which fills in the generators and the provider.
// TOPICS ids and names are fixed: the teacher options screen (package A) lists them as toggles and stores the
// enabled ids in Questions.topics (null = all on).
// Excluded by the teacher: completing a similarity statement, and scale-factor / perimeter-ratio problems.

export const UNIT = { id: 'geo_c_unit4', name: 'Unit 4: Similar Figures' };

export const TOPICS = Object.freeze([
  { id: 'ratio_simplest', day: 1, name: 'Ratios in simplest form' },
  { id: 'extended_ratio', day: 1, name: 'Extended ratios (angles and sides)' },
  { id: 'proportion', day: 1, name: 'Solving proportions' },
  { id: 'similar_missing_side', day: 2, name: 'Missing sides of similar triangles' },
  { id: 'similarity_proof', day: 3, name: 'Similar by AA, SSS or SAS?' },
  { id: 'triangle_proportionality', day: 4, name: 'Triangle Proportionality Theorem' },
  { id: 'parallel_proportional', day: 4, name: 'Parallel lines and proportional parts' },
  { id: 'angle_bisector', day: 4, name: 'Triangle Angle Bisector Theorem' },
]);
