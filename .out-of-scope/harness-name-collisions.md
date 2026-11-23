# Renaming skills to dodge harness built-in commands

Skill names are not changed because a harness ships a built-in command or skill with the same name (`/prototype`, `/research`, `/code-review`, and so on). Requests to rename a skill, or add an alias, to avoid a collision are out of scope.

## Why this is out of scope

Harnesses add built-ins all the time, and each harness picks its own names. Renaming every time one of them lands on a name we already use would mean chasing a moving target across Claude Code, Copilot, Devin and the rest, and breaking every user's muscle memory and every cross-reference between skills each time.

How a harness resolves two things with the same name is the harness's behaviour, not the skill's. The skill text is correct either way.

The way through is namespaced invocation. The Claude Code plugin exposes every skill under its plugin name, so you can always reach ours explicitly:

```
/mattpocock-skills:research
/mattpocock-skills:code-review
```

If you installed with skills.sh, the files are yours: rename the folder and the `name:` field in your copy.

If a harness gives you no way to reach a namespaced or renamed skill at all, report that to the harness.

## Prior requests

- #423: "/code-review shadows Claude Code own review skill"
- #483: "/code-review name clash with Claude Code built-in"
- #857: "Rename the research skill to avoid conflict with Copilot's built-in /research command"
- #1019: "Shorthand `/prototype` conflicts with hidden new Claude Code built-in skill `/prototype`"
- #1037: "Skill name overlap with devin cli inbuilt commands"

## In this fork

Everything above this section is upstream's text, written for its own `mattpocock-skills` plugin. This fork keeps the same rule: it does not rename a skill or add an alias to avoid a collision.

Each Real Skills edition is a plugin under its own name, so the prefix differs from upstream's:

```
/real-skills-leashed:code-review
/real-skills-unleashed:code-review
```

On Claude Code, with this fork's plugin installed and every other provider of these skills removed, the bare `/code-review` was observed listing Claude Code's built-in beside the plugin's qualified skill. So `implement` and `implement-spec` call this collection's own `code-review` by the plugin-qualified name they were loaded under, not by the bare name. Which other names get a qualified call is decided by [Harness built-in names](../docs/agents/release-archives.md#harness-built-in-names); every other call keeps the bare name, the portable identity across plugin and standalone installs.

Before an edition is qualified for a harness, its skill names are compared with that harness's built-in names. The result is recorded in [Harness built-in names](../docs/agents/release-archives.md#harness-built-in-names).
