#!/usr/bin/env bash
# 发布站点到 gh-pages 分支（不依赖 GitHub Actions）
#
# 用法：./scripts/deploy.sh
#
# 原理：把工作区（排除 .git / .github / scripts）打成一次性提交推到 gh-pages 分支，
#       推送内容即工作区快照，不需要累积历史。
#       仓库 Settings → Pages 的 Source 选 "Deploy from a branch"，分支 gh-pages，目录 / (root)。

set -euo pipefail

MAIN_REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$MAIN_REPO"

BRANCH="gh-pages"
REMOTE_URL=$(git -C "$MAIN_REPO" remote get-url origin)

# 优先用本仓库配置的提交身份，没有就退回全局
NAME=$(git config --local user.name  2>/dev/null || git config user.name  2>/dev/null || echo "EMOAIRX")
EMAIL=$(git config --local user.email 2>/dev/null || git config user.email 2>/dev/null || echo "EMOAIRX@users.noreply.github.com")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "▸ 收集要发布的文件…"
rsync -a --exclude '.git/' --exclude '.github/' --exclude 'scripts/' \
      --exclude '.DS_Store' "$MAIN_REPO"/ "$TMP/site/"

cd "$TMP/site"
git init -q -b "$BRANCH"
git config user.name  "$NAME"
git config user.email "$EMAIL"
touch .nojekyll
git add -A

if git diff --cached --quiet; then
  echo "▸ 内容无变化？先检查 rsync 是否成功。" >&2
fi

git commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"

echo "▸ 推送到 ${BRANCH}（${NAME} <${EMAIL}>）…"
GIT_TERMINAL_PROMPT=0 git -c credential.helper=osxkeychain push -f "$REMOTE_URL" "$BRANCH:refs/heads/${BRANCH}"

echo "✓ 已发布： https://emoairx.github.io/fund-exam-site/"
