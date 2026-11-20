# Wayfinder lifecycle examples

These examples show assessment, classification, claims, and execution authority as separate facts. Apply the project's actual tracker policy and capabilities.

## Map followed by triage

A map has settled which audit records an export may include. A new request asks for one export format. The planning owner checks that the parent assessment covers this request's inputs, constraints, and next decision, then records the assessment pointer and coverage. Membership in the map alone would not establish that.

The incoming request still needs `triage` to establish its issue classification and readiness under project policy. If it is also a decision ticket, retain its applicable Wayfinder type and map relationship. Permitted kind, domain, priority, or triage classifications can coexist; add only those that apply. If it is an implementation request, linking the map does not turn it into a Wayfinder decision ticket.

Keep any existing claim. An open prerequisite still blocks the request, and an undecided human choice stays with the human. A clear map does not grant implementation authority; the implementation workflow uses an applicable direct human grant.

## Linear Triage

An incoming request is in a Linear project's native Triage state. The planning owner assesses its route, reusing a current direct or parent assessment where adequate. The request remains in Triage until the project's `triage` workflow has actually completed the required classification and state transition. Do not add a second `needs-triage` label to represent the same state.

Use the project's supported parent and blocking relationships independently, following the native operation's direction. If the available tool cannot perform a required state transition or relationship update, report that capability limit and return the proposed change. A label or body link does not prove a native transition or relationship exists.

Preserve the assignee's claim, unresolved blockers, and human decisions. An assessment does not move the request out of Triage or make an ungranted action permissible.

## Pre-work freshness

A parent assessment covers a bounded parser change. Before work begins, the planning owner checks the current inputs and discovers that a supplier changed the format on which the assessment relied. The old parent assessment remains useful for unaffected decisions, but its parser conclusion needs a refresh.

Assess the changed format and the evidence needed for this increment. Do not open a mandatory submap or reassess unrelated backlog items. A ticket already claimed by another session remains theirs; coordinate through the project's claim convention. If a human must choose whether the new format is supported, record that decision as the hold, the human as its owner, and the recorded support decision as the return trigger.

If the inputs had remained unchanged and the parent assessment still covered the task, link it and proceed to the next eligible step under the existing grant.

## Post-return continuation

A worker returns a proposed adapter and a new supplier dependency. The planning owner compares the return with the parent outcome and acceptance evidence before adding that dependency to the route. If the existing qualified method already answers the question, keep that route and leave the optional adapter as follow-up. If the supplier result is necessary, record exactly which question depends on it.

A supplier reporting a blocker does not resolve the decision ticket. Keep it open, preserve its claim and blocker, and name the owner and exact return trigger, such as receipt of the specified compatibility result. Select an independent eligible frontier ticket when one exists; its progress does not clear the blocked branch.

When returned evidence actually resolves a question, record the answer and update the map under the existing tracker grant. Refresh the affected parent assessment, then select the next eligible frontier. A pending human choice still needs the human's answer. If this session has already resolved its one non-research ticket, hand the next selection to a fresh session rather than resolving another ticket here.

## No specialist roles

A project has one agent and a tracker, and its policy names no planning roles. A request arrives to add an export filter. The agent running the lifecycle is the planning owner. It bounds the intake, finds no assessment that covers it, assesses the route itself, and records the result. It does not look for a specialist, and the absence of one is not a hold.

A subagent the agent started returns the filter's test results. Nothing in the plan, criteria, or scope has moved, so the refresh is routine: the agent updates the affected conclusion and continues to the next eligible step.

A later return shows the filter needs a schema change the request never mentioned. Scope has changed, so the refresh is consequential. The agent reassesses the affected part itself before any further work. Whether to take on the schema change is the human's decision, so the agent records that hold, the human as its owner, and the recorded decision as the return trigger. Independent eligible work continues.

## Split planning ownership

A project's policy gives initial intake and mapping to one role and routine refresh to another, and lists the cases that return to the first. A worker returns a result that fits the plan. The owner of routine refresh updates the assessment and selects the next eligible ticket without involving the mapping owner.

The next return proposes work with no clear place in the map. That is one of the policy's listed cases, so the refresh owner sends the changed evidence to the mapping owner and records the hold on the affected branch. Unaffected branches keep moving. If the mapping owner cannot be reached, the hold names that owner and what its answer must settle; the refresh owner does not remap in its place.
