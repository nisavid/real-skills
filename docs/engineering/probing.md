## What it does

`probing` resolves **one named uncertainty** before the next piece of work relies on a guess. It looks for the smallest adequate observation: a versioned contract, an applicable earlier result, or a bounded experiment.

The question decides whether anything needs to run. If the documentation already establishes the promise your design needs, probing can finish with a citation. If you need to know what an installed service actually does, a promise on paper is only part of the answer.

## When to reach for it

Type `/probing`, or the agent can invoke it when the task fits. Invocation keeps the task's existing authority; it does not grant access to credentials, networks, or live state.

| What is holding up the work? | Reach for |
| --- | --- |
| An adapter depends on an uncertain return value or error contract | `probing`, with the specific behavior and version named |
| A design choice depends on whether a technical assumption holds | `probing`, then return the result to that decision |
| An earlier result may already answer the question | `probing`, to check whether its evidence still applies |
| You need to see and react to a UI or state model | [prototype](https://aihero.dev/skills-prototype), preserving your reactions and decisions |
| Something already built is broken and you need its cause | [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs) |
| The contract is settled and the next step is implementation | Continue the implementation, using [tdd](https://aihero.dev/skills-tdd) where appropriate |

For reading legwork across external sources, [research](https://aihero.dev/skills-research) gathers the facts. Probing is useful when one uncertainty needs a bounded answer and a clear consequence for the work waiting on it.

## An answer that changes the next step

Suppose an adapter design assumes a parser preserves duplicate keys. A small observation using the relevant parser version and one input with duplicate keys may settle that assumption. If the output retains only one value, the adapter needs a different contract.

The record carries the input, version, output, and limits so someone else can judge that conclusion. If the parser never starts, preservation remains unknown. The failed attempt tells you what blocked the observation, not how the parser handles duplicate keys.

Earlier evidence can be enough. When its relevant conditions still match, the next task can reuse the result. A change to the parser version or configuration means checking whether the conclusion still applies.

## Common questions

**Does probing always run code?**

No. Documentation, source, or a retained observation can supply the answer. The evidence must match the claim: a specification can establish a promised behavior, while a claim about what a running system actually did needs an observation of that system.

**Does a confirmed result mean the feature is ready?**

It means the named hypothesis has support within the observed conditions. The consuming work still has its own acceptance requirements. A local fixture does not qualify production, and a technical result does not replace your design decision. A bounded attempt can also finish with an unknown result while the dependent work remains blocked.

## It's working if

- The question is specific enough that you can say what the next decision needs from the answer.
- The result names its evidence and conditions, including when an existing result made another experiment unnecessary.
- A contrary result changes the assumption, while a failed observation leaves an explicit unknown.
- The next discovery, design, or TDD step uses the result without treating it as broader approval.
- Any temporary changes have a reported restoration outcome, and your design reactions remain your own.

## Where it fits

`probing` is a reach-for-it-anytime standalone that returns evidence to the work that needed it. [prototype](https://aihero.dev/skills-prototype) supplies something a person can react to when the unresolved point is a design choice; [tdd](https://aihero.dev/skills-tdd) turns established behavior into tested implementation. [ask-matt](https://aihero.dev/skills-ask-matt) maps the rest of the skills.
