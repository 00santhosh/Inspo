# Inspo Canvas

**Read [CONTEXT.md](./CONTEXT.md) first.** It holds the product goal, design decisions, current status, backend/deploy state, gotchas and next steps from the build so far. Also read [AGENTS.md](./AGENTS.md) for the Expo rules (check the SDK 57 docs; don't trust memory for Expo APIs).

Hard rules:
- GitHub: only the `00santhosh` account. Never `santhooshh-design`. Check commit authors before pushing.
- Never commit keys or `.env*` files. Don't use or request Supabase service-role/secret keys.
- Commit and push only when the owner asks. Run `npx tsc --noEmit` and `npx expo lint` before declaring anything done.
- After deleting or renaming source files, restart Metro with `--clear` (see CONTEXT.md, "Gotchas").
- Update CONTEXT.md when status, decisions or setup change.
