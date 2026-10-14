# VS Code + WSL + Codex

1. Instale as extensões oficiais **WSL (Microsoft)**, **Codex (OpenAI)**, **Docker (Microsoft)** e **YAML (Red Hat)**. Kubernetes (Microsoft) e ESLint ficam para depois.
2. No Docker Desktop, habilite Settings → Resources → WSL Integration → Ubuntu.
3. Abra o Ubuntu e execute `mkdir -p ~/projects/infralab && cd ~/projects/infralab && code .`.
4. Confira `WSL: Ubuntu` no canto inferior esquerdo do VS Code.
5. No painel Codex, faça login com sua conta ChatGPT. O login ChatGPT não exige chave da API; limites do plano podem se aplicar.
6. Execute `bash scripts/check-environment.sh`.
7. No Codex: `Leia AGENTS.md e docs/ROADMAP.md. Faça somente o módulo 1, explicando e testando cada passo.`
8. Para GitHub: crie repositório vazio e execute `git init`, `git add .`, `git commit -m "chore: initialize infralab"`, `git branch -M main`, `git remote add origin URL_DO_REPOSITORIO`, `git push -u origin main`.
