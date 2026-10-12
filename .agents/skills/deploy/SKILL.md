---
name: deploy-bike-calculator
description: Deploy the Bike Workshop Calculator to the Rückenwind production host using the repository's SFTP deployment script. Use only when the user explicitly requests a deployment.
---

# Deploy Bike Workshop Calculator

Use this skill to run the repository's existing deployment script from the checkout root.

## Safety and prerequisites

- This deploys to the live site. Run it only when the user explicitly asks to deploy (for example, “deploy it now”). Merely asking to prepare, review, or explain deployment is not authorization.
- Before starting, verify the current branch and working tree with `git status --short --branch`. The script runs `git push origin HEAD` (best-effort) before building, then uploads files and removes obsolete hashed assets on the server. If there are uncommitted changes or the branch/target is unclear, stop and ask the user rather than publishing unexpectedly.
- Required shell environment variables: `DEPLOY_USER`, `DEPLOY_HOST`, `PASSWORD`, and `REMOTE_DIR`. Never ask the user to paste a password into chat, print credentials, or save them in repository files. If they are not already securely available in the shell environment, explain how to set them locally and stop.
- `expect`, `sftp`, `curl`, Node.js, and npm must be available. If not, report the missing dependency; do not install software or change the deployment script without permission.
- The script uses password-based SFTP. Treat its use as sensitive; never echo shell commands containing secret values.

## Procedure

1. From the repository root, check branch/worktree and required dependencies. Confirm all four variables are set without displaying their values (e.g. test `[[ -n "${DEPLOY_USER:-}" && -n "${DEPLOY_HOST:-}" && -n "${PASSWORD:-}" && -n "${REMOTE_DIR:-}" ]]`).
2. If the checkout is clean, the target is unambiguous, and the required environment is ready, run `./scripts/deploy.sh` from `/work` (or the repository root).
3. Report whether it completed, including any warnings from the script. Do not claim success if it failed or if the live-site verification did not succeed.

## Never

- Run the deployment based on inferred intent or a request to “work on deployment.”
- Put secrets in command-line arguments, chat, logs, committed files, or generated artifacts.
- Bypass the script's build/upload/prune/verification steps or manually delete remote files.
