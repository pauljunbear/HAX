# /commit - Git Commit Workflow

Commit all staged changes with a descriptive message.

## Instructions

1. First, check the current git status:

```bash
git status
git diff --staged
```

2. If there are unstaged changes, ask whether to include them.

3. Generate a commit message following these rules:

   - Use conventional commit format: `type(scope): description`
   - Types: feat, fix, refactor, style, docs, test, chore
   - Keep first line under 72 characters
   - Add body for complex changes

4. Create the commit:

```bash
git add . # if user wants all changes
git commit -m "$(cat <<'EOF'
type(scope): brief description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

5. Show the result:

```bash
git log -1 --oneline
```

## Example Usage

User: `/commit`

Response: Check status, propose message, commit with co-author.
