# Matt Pocock Skills

A fork of Matt Pocock's agent skills for Claude Code, Codex, and other Agent Skills-compatible harnesses.

## Language

**Issue tracker**:
The system that hosts a repository's **Issues**, such as GitHub Issues, Linear, or a local Markdown tracker.
_Avoid_: backlog, backlog manager, backlog backend, issue host

**Issue**:
A tracked unit of work in an **Issue tracker**, such as a bug, task, spec, or implementation slice.
_Avoid_: ticket (except **Decision ticket** or external systems' terminology)

**Decision ticket**:
A Wayfinder **Issue** holding a question whose resolution is a decision rather than an implementation slice.

**Triage role**:
A category or state in the [triage vocabulary](docs/agents/triage-labels.md) for implementation **Issues**. Category roles describe the kind of work (`bug` or `enhancement`); state roles describe its triage status (such as `needs-triage` or `ready-for-agent`).

**Classification axis**:
One of four independent ways to classify an **Issue**: **Work kind**, **Triage state**, **Map structure**, and **Decision type**. Each axis has one owning workflow, and an Issue carries only the axes that apply to it.
_Avoid_: label family, dimension

**Work kind**:
The kind of work an **Issue** asks for, named by one of the project's category roles, such as `bug` or `enhancement`. A triaged Issue has one.
_Avoid_: issue type (except a tracker's own field of that name), category (alone)

**Triage state**:
Where an incoming **Issue** stands in triage: awaiting evaluation, waiting on its reporter, ready for an agent, ready for a human, or declined. A triaged Issue has one. A tracker's native intake state can express it.
_Avoid_: workflow state, lifecycle status

**Map structure**:
Whether an **Issue** is a Wayfinder map that coordinates child Issues toward a destination. It applies or it does not.
_Avoid_: epic, project (except a tracker's own feature of that name)

**Decision type**:
How a **Decision ticket**'s question is resolved, such as by research, a prototype, a grilling session, or a prerequisite task. An Issue has none or one, and a map can keep one while it still owns that decision.
_Avoid_: next operation, ticket kind

**Promotion**:
Turning an existing **Decision ticket** into a map in place, so that it keeps its identity, its membership in the larger map, its claim, and its blockers.
_Avoid_: conversion, re-filing

**Authority**:
The **Issue tracker** that a project's policy names as the source of truth for one fact, such as a blocker or a triage state. Skills read and write that fact there.
_Avoid_: primary tracker, source of record (alone)

**Projection**:
A copy of a fact in an **Issue tracker** other than its **Authority**. A relation that the authority records and the copy lacks is a projection gap.
_Avoid_: mirror (for the copied fact), replica

**Narrow write**:
A tracker change that adds or removes only the values its operation owns, between a read of the affected fields and a read-back of the result.
_Avoid_: label sync, set labels

**Material input**:
A fact that an assessment or decision depends on, such that a change to it can alter the next action or the acceptance criteria. An assessment stays current until a material input changes; age alone does not make it stale.
_Avoid_: dependency (alone), freshness window
