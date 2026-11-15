# ADR-004: Hand-written scenarios, seeded solutions, generate-then-prove

Status: accepted

## Decision

1. Settings and casts are written by hand as a `Scenario`. Each playthrough's victim, killer, weapon, motive, room, time and timeline come from a seed.
2. Every statement and clue is derived from the simulated ground truth.
3. The rules about who may lie, and how, are fixed, small, and **told to the player**.
4. A solver enumerates every hypothesis those rules allow and accepts a case only if exactly one (killer, weapon, motive) survives. Failing cases are repaired or regenerated. A constructed fallback guarantees the generator always returns a unique case.
5. Deduction in v1 is over a grid of people, rooms and half-hour slots, with complete "who was with me" statements. No movement rules.

Full spec: `case-engine.md`.

## Why

- **Public lying rules** are what make fairness provable. If the player and the solver share one rule list, "the solver finds exactly one answer" means "exactly one answer can be proven". A solver with private assumptions could only show a case is probably fair.
- **Hypothesis enumeration** is simple to get right. The space is tiny (a few hundred hypotheses, each checked in microseconds), so there is no need for a general constraint solver or clever inference, both of which are easy to get subtly wrong.
- **Complete statements** ("exactly these people were with me") give the player absence deductions, which is where contradictions come from, and they make the consistency check a handful of comparisons.
- **Killer lies about one slot only** keeps the player's reasoning tractable on a phone, and makes "means" a crisp check: the killer truthfully admits when they were alone with the weapon.
- **The second liar** (shield or secret-keeper) supplies the layered "one lie unlocks another" moments without widening who can lie.
- **No movement rules** keeps the generator and the player's bookkeeping simple. Adjacency is in the schema so it can be added.

## What we accept

- Cases share a structure. Variety comes from the cast, the seed and the difficulty, not from novel plot shapes.
- "Where" is trivial in v1 because the body is not moved.
- A small share of seeds may fall back to a simpler, more direct case. The CLI reports the rate.

## Interpretation of the brief

The brief allows "at most one accomplice or protector with their own reason" to lie. This design models that as one **second liar** of two kinds: a **shield**, who vouches falsely for the killer because of a bond, and a **secret-keeper**, who lies about their own whereabouts for a private reason. The secret-keeper is a slight widening of the brief's wording; it is kept because it produces the best chains of deduction.
