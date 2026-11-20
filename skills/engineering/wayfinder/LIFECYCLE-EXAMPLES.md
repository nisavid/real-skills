# Wayfinder lifecycle examples

These examples show assessment, classification, claims, and execution authority as separate facts. Apply the project's actual tracker policy and capabilities.

## Map followed by triage

A map has settled which audit records an export may include. A new request asks for one export format. Sage checks that the parent assessment covers this request's inputs, constraints, and next decision, then records the assessment pointer and coverage. Membership in the map alone would not establish that.

The incoming request still needs `triage` to establish its issue classification and readiness under project policy. If it is also a decision ticket, retain its applicable Wayfinder type and map relationship. Permitted kind, domain, priority, or triage classifications can coexist; add only those that apply. If it is an implementation request, linking the map does not turn it into a Wayfinder decision ticket.

Keep any existing claim. An open prerequisite still blocks the request, and an undecided human choice stays with the human. A clear map does not grant implementation authority; the implementation workflow uses an applicable direct human grant.

## Linear Triage

An incoming request is in a Linear project's native Triage state. Sage assesses its route, reusing a current direct or parent assessment where adequate. The request remains in Triage until the project's `triage` workflow has actually completed the required classification and state transition. Do not add a second `needs-triage` label to represent the same state.

Use the project's supported parent and blocking relationships independently, following the native operation's direction. If the available tool cannot perform a required state transition or relationship update, report that capability limit and return the proposed change. A label or body link does not prove a native transition or relationship exists.

Preserve the assignee's claim, unresolved blockers, and human decisions. An assessment does not move the request out of Triage or make an ungranted action permissible.

## Pre-work freshness

A parent assessment covers a bounded parser change. Before work begins, Sage checks the current inputs and discovers that a supplier changed the format on which the assessment relied. The old parent assessment remains useful for unaffected decisions, but its parser conclusion needs a refresh.

Assess the changed format and the evidence needed for this increment. Do not open a mandatory submap or reassess unrelated backlog items. A ticket already claimed by another session remains theirs; coordinate through the project's claim convention. If a human must choose whether the new format is supported, record that decision as the hold, the human as its owner, and the recorded support decision as the return trigger.

If the inputs had remained unchanged and the parent assessment still covered the task, link it and proceed to the next eligible step under the existing grant.

## Post-return continuation

A worker returns a proposed adapter and a new supplier dependency. Sage compares the return with the parent outcome and acceptance evidence before adding that dependency to the route. If the existing qualified method already answers the question, keep that route and leave the optional adapter as follow-up. If the supplier result is necessary, record exactly which question depends on it.

A supplier reporting a blocker does not resolve the decision ticket. Keep it open, preserve its claim and blocker, and name the owner and exact return trigger, such as receipt of the specified compatibility result. Select an independent eligible frontier ticket when one exists; its progress does not clear the blocked branch.

When returned evidence actually resolves a question, record the answer and update the map under the existing tracker grant. Refresh the affected parent assessment, then select the next eligible frontier. A pending human choice still needs the human's answer. If this session has already resolved its one non-research ticket, hand the next selection to a fresh session rather than resolving another ticket here.
