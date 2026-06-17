# 2K Cargo API VPS Deployment Cookbook

This cookbook deploys the service to a single Ubuntu VPS with Docker Compose,
Caddy TLS reverse proxy, SQLite persistence, and scheduled SQLite backups.

## Layout

```text
ansible/
  ansible.cfg
  inventory.example.ini
  examples/
    cargo_api.vault.yml.example
  group_vars/
    cargo_api/
      main.yml
      .gitkeep
  playbooks/
    deploy.yml
    backup.yml
  templates/
    Caddyfile.j2
    docker-compose.yml.j2
    env.j2
    backup-sqlite.sh.j2
```

## VPS Assumptions

- Ubuntu 22.04 or 24.04.
- DNS `A` / `AAAA` record for `app_domain` points to the VPS.
- SSH key access is already configured.
- The SSH user can run `sudo` for Ansible `become: true` tasks.
- The git remote in `app_repo_url` is reachable from the VPS.

## Bootstrap VPS User

Run these commands once on a fresh VPS before using Ansible. Most providers give
initial SSH access as `root`.

1. Generate a local SSH key if you do not already have one:

```bash
ssh-keygen -t ed25519 -C "2k-cargo-api-deploy" -f ~/.ssh/2k-cargo-api
```

2. Copy the public key to the VPS as `root`:

```bash
ssh-copy-id -i ~/.ssh/2k-cargo-api.pub root@YOUR_VPS_IP
```

If `ssh-copy-id` is not available, append the key manually:

```bash
cat ~/.ssh/2k-cargo-api.pub
ssh root@YOUR_VPS_IP
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

3. Create a dedicated deploy user:

```bash
ssh root@YOUR_VPS_IP
adduser deploy
usermod -aG sudo deploy
```

4. Install your SSH key for `deploy`:

```bash
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

5. Optional but recommended: allow passwordless sudo for Ansible:

```bash
cat >/etc/sudoers.d/deploy <<'EOF'
deploy ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/deploy
visudo -cf /etc/sudoers.d/deploy
```

If you do not enable passwordless sudo, run playbooks with `--ask-become-pass`.

6. Harden SSH after confirming `deploy` login works:

```bash
ssh -i ~/.ssh/2k-cargo-api deploy@YOUR_VPS_IP
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

Keep the current root SSH session open until a new `deploy` SSH session works.
If your VPS uses `sshd` instead of `ssh`, reload with `sudo systemctl reload sshd`.

7. Configure local SSH convenience.

This step is done on your local machine, not on the VPS. It creates a short SSH
alias, so you can run `ssh 2k-cargo-api` instead of repeatedly passing the VPS
IP, username, and private key path.

Create or edit `~/.ssh/config`:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/config
```

Add this host entry:

```sshconfig
Host 2k-cargo-api
  HostName YOUR_VPS_IP
  User deploy
  IdentityFile ~/.ssh/2k-cargo-api
  IdentitiesOnly yes
```

Replace `YOUR_VPS_IP` with the server IP or with the domain if DNS already
points to the VPS. `IdentityFile` must point to the private key generated in
step 1, not to the `.pub` file. `IdentitiesOnly yes` tells SSH to use that key
explicitly and avoids confusing authentication failures when the local SSH agent
has many keys loaded.

Fix config permissions, then test the alias:

```bash
chmod 600 ~/.ssh/config
ssh 2k-cargo-api
ssh 2k-cargo-api 'sudo whoami'
```

The second command must print `root`; otherwise Ansible `become: true` tasks will
fail.

After this check passes, the Ansible inventory can use the same alias directly:

```ini
[cargo_api]
2k-cargo-api
```

If you prefer not to use `~/.ssh/config`, keep the full connection parameters in
`ansible/inventory.ini` instead:

```ini
[cargo_api]
YOUR_VPS_IP ansible_user=deploy ansible_port=22 ansible_ssh_private_key_file=~/.ssh/2k-cargo-api
```

## First-Time Setup

1. Copy the inventory and set the VPS host:

```bash
cp ansible/inventory.example.ini ansible/inventory.ini
```

2. Edit `ansible/inventory.ini`:

```ini
[cargo_api]
api.example.com ansible_user=deploy ansible_port=22 ansible_ssh_private_key_file=~/.ssh/2k-cargo-api
```

If you added the SSH config host above, this can also be:

```ini
[cargo_api]
2k-cargo-api
```

3. Edit non-secret vars in `ansible/group_vars/cargo_api/main.yml`:

- `app_domain`
- `caddy_site_address`
- `app_repo_url`
- `app_git_version`
- `session_ttl_seconds`
- backup retention/schedule

## Git Repository Access

The playbook checks out the application source on the VPS during the
`Checkout application source` task. `app_repo_url` must point to a repository
that the VPS can read.

For a public repository, prefer HTTPS because no GitHub key is required on the
server:

```yaml
app_repo_url: https://github.com/isaldin/2k-cargo-api.git
```

For a private repository, use SSH and add a read-only deploy key to the GitHub
repository:

```yaml
app_repo_url: git@github.com:isaldin/2k-cargo-api.git
```

Create the GitHub deploy key on the VPS as the SSH user used by Ansible:

```bash
ssh 2k-cargo-api
ssh-keygen -t ed25519 -C "2k-cargo-api-vps-deploy" -f ~/.ssh/2k-cargo-api-github
cat ~/.ssh/2k-cargo-api-github.pub
```

Add the printed public key in GitHub:

```text
Repository -> Settings -> Deploy keys -> Add deploy key
```

Leave write access disabled. The VPS only needs read access for deployment.

Configure the VPS SSH client to use that key for GitHub:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/2k-cargo-api-github
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
ssh -T git@github.com
```

A successful GitHub SSH test usually prints an authentication success message
and says shell access is not provided. That is fine; Git access is what the
playbook needs.

If deployment fails with `Repository not found` during checkout, either the
repository URL is wrong, the repository has not been pushed yet, or the VPS key
has not been added to that repository as a deploy key.

4. Create an encrypted vault file for secrets:

```bash
mkdir -p ansible/group_vars/cargo_api
cp ansible/examples/cargo_api.vault.yml.example ansible/group_vars/cargo_api/vault.yml
ansible-vault encrypt ansible/group_vars/cargo_api/vault.yml
```

Set `app_master_key` to a strong value that is exactly 32 bytes. Store it
permanently outside the VPS as well. If it is lost, existing encrypted upstream
passwords cannot be decrypted.

5. Run the deployment:

```bash
ANSIBLE_CONFIG=ansible/ansible.cfg \
ansible-playbook -i ansible/inventory.ini ansible/playbooks/deploy.yml --ask-vault-pass
```

## What Deploy Does

- Installs Docker Engine and Docker Compose plugin.
- Installs `git`, `sqlite3`, `ufw`, and base packages.
- Opens only SSH, HTTP, and HTTPS in UFW.
- Clones the app into `/opt/2k-cargo-api/current`.
- Renders `/opt/2k-cargo-api/.env`, `docker-compose.yml`, and `Caddyfile`.
- Builds the app image from the checked-out source.
- Starts `app` and `caddy` with Docker Compose.
- Runs an internal readiness probe against `/api/docs-json`.
- Installs a root-only SQLite backup script and cron job.

The app container is not published directly. Caddy exposes ports 80 and 443 and
proxies to the app over the Compose network.

## Backups

Backups use SQLite's online `.backup` command and write compressed files to
`/opt/2k-cargo-api/backups`.

Run a backup manually:

```bash
ANSIBLE_CONFIG=ansible/ansible.cfg \
ansible-playbook -i ansible/inventory.ini ansible/playbooks/backup.yml --ask-vault-pass
```

Restore manually on the VPS:

```bash
cd /opt/2k-cargo-api
docker compose down
cp data/sessions.sqlite "data/sessions.sqlite.broken-$(date -u +%Y%m%dT%H%M%SZ)"
gunzip -c backups/sessions-YYYYMMDDTHHMMSSZ.sqlite.gz > data/sessions.sqlite
chown 1000:1000 data/sessions.sqlite
docker compose up -d
```

## Post-Deploy Smoke

Run from a trusted machine with Node dependencies installed:

```bash
APP_BASE_URL=https://api.example.com \
SMOKE_PHONE=77073006789 \
SMOKE_PASSWORD='***' \
SMOKE_TRACK_CODE="SMOKE-$(date -u +%Y%m%d%H%M%S)" \
SMOKE_PACKAGE_NAME='Smoke Test Package' \
npm run smoke:upstream
```

The smoke script creates and deletes one upstream package. Use only a dedicated
test account.

## Rollback

Deploy a previous git ref:

```bash
ANSIBLE_CONFIG=ansible/ansible.cfg \
ansible-playbook -i ansible/inventory.ini ansible/playbooks/deploy.yml \
  --ask-vault-pass \
  -e app_git_version=<previous_tag_or_commit>
```

Then run the smoke script. If the new version changed persisted data and rollback
needs DB restore, restore from `backups/` before starting the stack.

## Notes

- `DATABASE_SYNCHRONIZE` is rendered as `false`; schema creation is handled by
  application migrations.
- Keep `APP_MASTER_KEY` stable across deploys.
- Do not commit `inventory.ini` or `cargo_api.vault.yml`.
