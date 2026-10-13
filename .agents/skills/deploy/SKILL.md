---
name: deploy-bike-calculator
description: Deploy the Bike Workshop Calculator to the Rückenwind production host using the repository's SFTP deployment script. Use only when the user explicitly requests a deployment.
---

# Deploy Bike Workshop Calculator

Use this skill to run the repository's existing deployment script from the checkout root.

## Safety and prerequisites

- This deploys to the live site. Run it only when the user explicitly asks to deploy (for example, “deploy it now”). Merely asking to prepare, review, or explain deployment is not authorization.
- Before starting, check the working tree with `git status --short --branch`. Deploying from any branch is fine; do not ask for confirmation about which branch is checked out. The script runs `git push origin HEAD` (best-effort) before building, then uploads files and removes obsolete hashed assets on the server. If there are uncommitted changes, stop and ask the user rather than publishing unexpectedly.
- Required shell environment variables: `DEPLOY_USER`, `DEPLOY_HOST`, `PASSWORD`, `REMOTE_DIR`, and `DEPLOY_URL` (the public page URL for verification). Never ask the user to paste a password into chat, print credentials, or save them in repository files. If they are not already securely available in the shell environment, explain how to set them locally and stop.
- `expect`, `sftp`, `curl`, Node.js, and npm must be available. If `expect` is missing, install it without asking (`sudo apt-get install -y expect`, running `sudo apt-get update` first if the install fails). For any other missing dependency, report it; do not install other software or change the deployment script without permission.
- The script uses password-based SFTP. Treat its use as sensitive; never echo shell commands containing secret values.

## Procedure

1. From the repository root, check the worktree and required dependencies (installing `expect` if needed). Confirm all five variables are set without displaying their values (e.g. test `[[ -n "${DEPLOY_USER:-}" && -n "${DEPLOY_HOST:-}" && -n "${PASSWORD:-}" && -n "${REMOTE_DIR:-}" && -n "${DEPLOY_URL:-}" ]]`).
2. If the checkout is clean and the required environment is ready, run `./scripts/deploy.sh` from `/work` (or the repository root).
3. Report whether it completed, including the name of the branch that was published and any warnings from the script. Do not claim success if it failed or if the live-site verification did not succeed.

## Never

- Run the deployment based on inferred intent or a request to “work on deployment.”
- Put secrets in command-line arguments, chat, logs, committed files, or generated artifacts.
- Bypass the script's build/upload/prune/verification steps or manually delete remote files.
