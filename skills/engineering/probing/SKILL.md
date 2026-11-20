---
name: probing
description: Resolve a named uncertainty with the smallest adequate observation or experiment before discovery, design, or TDD relies on a guessed contract. Use when the next decision depends on a fact that existing evidence may settle; human design choices stay with the human.
---

# Probing

A probe answers **one named uncertainty** with evidence the next piece of work can use. The question decides the instrument. Reading a versioned contract or reusing an applicable observation may finish the probe without running code.

## Name the uncertainty

Check model eligibility under the current task's policy before local work, and again when the scope materially changes. Invocation grants no additional action authority.

State the question and the decision waiting on it. Name the hypothesis, its relevant inputs and conditions, and what would confirm it, refute it, or leave it unknown. For example: "Does this parser preserve duplicate keys in this version? The adapter design currently assumes it does."

Use probing when there is a fact to establish:

| Situation | Route |
| --- | --- |
| An adapter depends on an uncertain return value or error contract | Probe the named behavior at the relevant version and boundary. |
| A retained observation might already answer the question | Check its provenance and applicability before doing more work. |
| Two designs differ because of a factual assumption | Probe that assumption, then return the evidence to the design decision. |
| The contract and next implementation step are settled | Continue the implementation; a speculative probe adds no acceptance evidence. |
| A person needs to react to a state model or UI | Use the existing `prototype` workflow for that reaction. |
| The unresolved point is a preference or consequential product decision | Use `grilling` with its decision owner. |
| Existing behavior is broken and its cause is unknown | Use `diagnosing-bugs`; a named observation inside that investigation may use probing. |

For an operative handoff, call the Skill tool with the named standing skill only when it is eligible and within the task's authority. Preserve the human's actual reactions and decisions. A technical observation does not supply missing design acceptance or turn an interactive prototype into unattended work.

## Choose the smallest adequate observation

Inspect the relevant documentation, source, and retained evidence first. Match each candidate to the question's version, inputs, environment, and boundary. Record why it is applicable or what is missing.

Documentation can settle what a published contract promises. Source can establish what a particular revision implements. Neither alone establishes what an installed service actually did. A retained run can answer that runtime question when its relevant conditions still apply.

If existing evidence is sufficient, cite it and stop gathering. Otherwise choose the smallest observation that distinguishes the hypothesis from its alternative. Prefer an existing task tool or a small disposable instrument. Use representative inputs for the claim; state what a fixture, mock, or reduced environment leaves unobserved.

Keep instruments task-specific. Building a universal probing harness, a broader demo, or production implementation is separate work. If preparing the instrument starts to dominate, compare the existing evidence and simpler observations again. Repair an instrument only for a named observation it blocks.

## Bound the effects before execution

For an observation that needs execution, establish:

- The exact target, bounded inputs, expected effects, and limits on duration, attempts, or resource use.
- The existing authority that covers those effects. Credentials, network access, installation, publication, and changes to live state are not granted by this skill.
- The state to preserve, any isolation needed, and how authorized temporary changes will be restored and checked.

Proceed within an existing grant without asking for it again. If the necessary effect is outside that grant, or the question needs a consequential decision, stop the dependent branch and return the specific need to its owner. Keep independent authorized work moving.

Run only the selected observation. Stop when it answers the question or reaches its bounds. A timeout or broken instrument is evidence about that attempt, not permission to widen access or keep retrying. Restore temporary state as planned; report what was verified and any remaining change or unknown restoration outcome.

## Record what the evidence establishes

Keep a concise result in the task's existing authorized evidence location, or return it to the caller when writing there is outside scope. Retain enough for a consumer to judge and reproduce the observation:

- The question, hypothesis, decision waiting on it, and acceptance criterion.
- The source reference or observed revision, relevant versions and configuration, inputs, observation date, and method.
- The actual result and a retrievable pointer to its supporting excerpt or raw evidence, distinguishing observed behavior from constructed conditions and interpretation.
- The conclusion, its limits, remaining unknowns, and restoration outcome when applicable.

Keep secrets out of the record. If redaction or an unavailable artifact removes evidence needed to assess the conclusion, say what can no longer be established.

| Outcome | Meaning |
| --- | --- |
| **Confirmed within scope** | Adequate evidence supports the hypothesis under the named conditions. State those conditions with the conclusion. |
| **Refuted within scope** | Adequate evidence contradicts the hypothesis under the named conditions. State the counterexample or contrary contract. |
| **Unknown** | The observation was unavailable, inconclusive, contradictory, or insufficient for the claim. Identify the gap and the smallest next observation or owner decision. |

A negative result can be useful evidence. If a parser returns one value for an input with two duplicate keys, that can refute preservation for that input. Failure to start the parser leaves preservation unknown. A search that finds no example establishes only what was searched unless its coverage supports a stronger claim.

Confirmation is not general qualification. A local fixture does not qualify production behavior, a source inspection does not qualify an installation, and one successful case does not establish every supported input.

## Return the result to its consumer

Explain what changes in the work that asked the question:

- **Discovery:** replace the named assumption with the supported fact and its limits; keep unanswered questions explicit.
- **Design:** identify which option or contract the evidence supports or rules out. Preserve recorded human decisions and bring any newly consequential choice back to its owner. If the domain model needs active revision, call the Skill tool with "domain-modeling" within that authority.
- **TDD:** supply the established behavior and evidence to the owning `tdd` work. Preserve its seam agreement and red-before-green requirements. A probe's output is not automatically a regression test or an independently justified expected value.

Link the result where the consumer will find it before dependent work. Reuse it only after checking the relevant evidence dependencies against the current task. Changed behavior, version, configuration, inputs, or a changed question can invalidate the affected conclusion; elapsed time alone neither proves freshness nor requires rerunning an unchanged observation.

The probe is complete when its result is supported and bounded, any effects are accounted for, and the consumer knows what can proceed and what remains unknown or decision-dependent. An unknown result can finish a bounded attempt while leaving the consuming task blocked.

## Evidence examples

These are illustrative acceptance cases, not observations already made.

| Question and input | Adequate evidence | Consequence |
| --- | --- | --- |
| Does the versioned contract promise ordered output? | The owning specification explicitly states ordering for that version and operation. | Discovery can record the documented promise without a live call; runtime compliance remains unobserved. |
| Does this parser preserve both duplicate keys? | An authorized local run records the parser version, literal input, and actual output containing one value. | Refute preservation for that case and revise the adapter assumption. |
| Does a service accept the proposed request? | The attempted call fails before the service processes the request. | Acceptance remains unknown; report the failed attempt without inventing the service's response. |
| Can an earlier observation settle the same adapter question? | Its retained input and output are available, and the relevant code, dependency version, and configuration still match. | Reuse it and give the consumer its provenance instead of creating another instrument. |
