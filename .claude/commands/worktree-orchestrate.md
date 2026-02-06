---
description: "git worktree를 활용해 워커별 독립 작업 공간을 만들고 병렬 처리합니다. 각 워커는 자체 브랜치에서 커밋합니다."
allowed-tools: ["Bash", "Read", "Write", "Edit"]
---

# Worktree 오케스트레이션

git worktree로 워커별 독립 작업 공간을 생성하고, 각 워커가 자체 브랜치에서 작업 후 커밋합니다.
merge는 사용자가 결과 확인 후 직접 진행합니다.

## 작업 요청

$ARGUMENTS

## orchestrate.md와의 차이점

| 항목 | orchestrate.md | 이 커맨드 |
|------|---------------|-----------|
| 작업 공간 | 같은 프로젝트 디렉토리 공유 | 워커마다 독립된 worktree |
| 파일 충돌 | 같은 파일 수정 시 충돌 가능 | 완전 격리, 충돌 불가 |
| 결과 보존 | 임시 파일로 결과 전달 | git 브랜치에 커밋으로 보존 |
| merge | 즉시 반영 | 사용자가 확인 후 수동 merge |

## 실행 절차

---

### STEP 1: 프로젝트 정보 수집

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
PROJECT_NAME=$(basename "$PROJECT_ROOT")
PARENT_DIR=$(dirname "$PROJECT_ROOT")
CURRENT_BRANCH=$(git branch --show-current)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌳 Worktree 오케스트레이션 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 프로젝트: $PROJECT_ROOT"
echo "🌿 현재 브랜치: $CURRENT_BRANCH"
echo ""
```

위 명령을 실행해서 프로젝트 경로, 이름, 상위 디렉토리, 현재 브랜치를 파악합니다.

이후 모든 경로 변수에 이 값들을 사용합니다:
- `PROJECT_ROOT`: 프로젝트 루트 경로
- `PROJECT_NAME`: 프로젝트 폴더 이름
- `PARENT_DIR`: 프로젝트 상위 디렉토리
- `CURRENT_BRANCH`: 현재 체크아웃된 브랜치

---

### STEP 2: 작업 분해 및 브랜치 계획

`$ARGUMENTS` 내용을 분석해서 하위 작업으로 분해합니다.

각 워커에 대해 **브랜치 이름**을 결정합니다.

브랜치 네이밍 규칙: `orch/작업요약-N`
- 작업요약은 영문 소문자, 하이픈으로 구성, 최대 20자
- 예: `orch/review-api-0`, `orch/fix-auth-1`, `orch/refactor-utils-2`

```bash
echo "📋 작업 요청: $ARGUMENTS"
echo ""
echo "📦 하위 작업 분해:"
echo "  [워커 0] orch/작업요약-0 → 작업 내용"
echo "  [워커 1] orch/작업요약-1 → 작업 내용"
echo "  ..."
echo ""
echo "🌳 Worktree 경로:"
echo "  [워커 0] $PARENT_DIR/$PROJECT_NAME-worker0/"
echo "  [워커 1] $PARENT_DIR/$PROJECT_NAME-worker1/"
echo "  ..."
echo ""
```

---

### STEP 3: 환경 준비

기존 오케스트레이션 잔여물을 정리합니다.

```bash
# 이전 실행의 tmux 세션 정리
for s in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^wt_worker_'); do
  tmux kill-session -t "$s" 2>/dev/null
done

# 이전 실행의 worktree 정리 (orch/ 브랜치로 된 것만)
git worktree list --porcelain | grep "^worktree" | awk '{print $2}' | while read wt; do
  case "$wt" in
    *-worker[0-9]*)
      git worktree remove --force "$wt" 2>/dev/null
      ;;
  esac
done

# 이전 완료 신호 정리
rm -f /tmp/wt_done_*

echo "✅ 환경 준비 완료"
```

---

### STEP 4: Worktree 생성 및 워커 실행

각 워커마다 아래를 순서대로 실행합니다. **워커 번호는 0부터 시작합니다.**

#### 4-A. 브랜치 + Worktree 생성

```bash
BRANCH_NAME="orch/작업요약-N"
WORKTREE_PATH="$PARENT_DIR/$PROJECT_NAME-workerN"

# 현재 브랜치 기준으로 새 브랜치와 worktree를 동시에 생성
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$CURRENT_BRANCH"

echo "🌳 [워커 N] worktree 생성: $WORKTREE_PATH (브랜치: $BRANCH_NAME)"
```

각 부분의 의미:
- `git worktree add`: 새 작업 트리 생성
- `-b "$BRANCH_NAME"`: 새 브랜치를 함께 생성
- `"$WORKTREE_PATH"`: worktree가 위치할 경로 (프로젝트 외부)
- `"$CURRENT_BRANCH"`: 이 브랜치를 기반으로 분기

#### 4-B. tmux 세션 생성 및 작업 전달

```bash
tmux new-session -d -s wt_worker_N

tmux send-keys -t wt_worker_N "cd $WORKTREE_PATH && claude -p \"

[여기에 하위 작업 내용을 구체적으로 작성]

현재 작업 디렉토리: $WORKTREE_PATH
브랜치: $BRANCH_NAME
원본 브랜치: $CURRENT_BRANCH

규칙:
1. 이 worktree 안의 파일만 수정할 것
2. 작업이 완료되면 변경 사항을 커밋할 것:
   git add -A
   git commit -m 'orch: 커밋 메시지 (작업 요약)'
3. 커밋 메시지는 'orch: '로 시작할 것
4. 절대 다른 브랜치로 checkout하지 말 것
5. 절대 push하지 말 것
6. 작업 완료 후 반드시 실행: touch /tmp/wt_done_N

\" --allowedTools \"Read,Write,Edit,Bash\" && touch /tmp/wt_done_N" Enter

echo "🔧 [워커 N] 작업 시작 (브랜치: $BRANCH_NAME)"
```

모든 워커 생성 완료 후:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ 전체 워커 N개 실행 중... 완료까지 대기합니다"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

### STEP 5: 완료 대기 및 실시간 모니터링

```bash
TOTAL=N
TIMEOUT=600    # worktree 작업은 커밋까지 하므로 10분으로 넉넉하게
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    DONE=$(ls /tmp/wt_done_* 2>/dev/null | wc -l | tr -d ' ')

    echo ""
    echo "── [${ELAPSED}s] 진행 상황: ${DONE}/${TOTAL} 완료 ──"

    for i in $(seq 0 $((TOTAL - 1))); do
        if [ -f /tmp/wt_done_$i ]; then
            echo "  ✅ [워커 $i] 완료"
        else
            LAST_LINE=$(tmux capture-pane -t wt_worker_$i -p 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-60)
            echo "  ⏳ [워커 $i] 작업중... $LAST_LINE"
        fi
    done

    if [ "$DONE" -ge "$TOTAL" ]; then
        echo ""
        echo "🎉 모든 워커가 완료되었습니다!"
        break
    fi

    sleep 10
    ELAPSED=$((ELAPSED + 10))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo "⚠️  타임아웃! 일부 워커가 완료되지 않았습니다."
fi
```

---

### STEP 6: 결과 확인 — 각 브랜치의 커밋과 diff 표시

각 워커 브랜치의 변경 내용을 보여줍니다.

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Worktree 오케스트레이션 결과"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

각 워커 브랜치에 대해 아래를 실행합니다:

```bash
BRANCH_NAME="orch/작업요약-N"

echo ""
echo "── [워커 N] 브랜치: $BRANCH_NAME ──"

# 이 브랜치에서 추가된 커밋 목록
git log $CURRENT_BRANCH..$BRANCH_NAME --oneline

# 변경된 파일 목록
git diff $CURRENT_BRANCH..$BRANCH_NAME --stat

# 실제 변경 내용 (간략히)
git diff $CURRENT_BRANCH..$BRANCH_NAME
```

마지막에 종합 요약을 출력합니다:

```
🌳 Worktree 오케스트레이션 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

총 워커: N개
기준 브랜치: $CURRENT_BRANCH

[워커 0] orch/작업요약-0 → 커밋 M개, 파일 X개 변경
[워커 1] orch/작업요약-1 → 커밋 M개, 파일 X개 변경
...

📌 merge 하려면:
  git merge orch/작업요약-0
  git merge orch/작업요약-1
  ...

📌 특정 브랜치 변경 내용 자세히 보려면:
  git diff $CURRENT_BRANCH..orch/작업요약-0

📌 merge 없이 브랜치 삭제하려면:
  git branch -D orch/작업요약-0
```

---

### STEP 7: 현재 상태 안내

**tmux 세션, worktree, 브랜치 모두 유지됩니다. 사용자가 직접 정리를 요청할 때까지 종료하지 않습니다.**

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Worktree 오케스트레이션 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 tmux 세션 (유지 중):"
tmux list-sessions 2>/dev/null | grep '^wt_worker_'
echo ""
echo "📌 worktree (유지 중):"
git worktree list
echo ""
echo "📌 브랜치 (유지 중):"
git branch | grep 'orch/'
echo ""
echo "💡 워커 세션에 직접 들어가 보려면:"
echo "  tmux attach -t wt_worker_0    (나오려면: Ctrl+B → D)"
echo ""
echo "💡 worktree 디렉토리에서 직접 확인하려면:"
echo "  cd $PARENT_DIR/$PROJECT_NAME-worker0"
echo "  ls -la"
echo ""
echo "💡 merge 하려면:"
echo "  git merge orch/작업요약-0"
echo ""
echo "💡 수동 정리 명령어:"
echo "  세션 종료:    for s in \$(tmux list-sessions -F '#{session_name}' | grep '^wt_worker_'); do tmux kill-session -t \"\$s\"; done"
echo "  worktree 삭제: git worktree remove $PARENT_DIR/$PROJECT_NAME-workerN"
echo "  브랜치 삭제:   git branch -D orch/작업요약-N"
echo "  전체 정리:     git worktree prune"
```

---

## 중요 규칙

1. **Worktree 경로**: 반드시 프로젝트 외부(`$PARENT_DIR/$PROJECT_NAME-workerN`)에 생성합니다
2. **브랜치 격리**: 각 워커는 자기 브랜치에서만 작업하고, 절대 다른 브랜치로 checkout하지 않습니다
3. **커밋 필수**: 워커는 작업 완료 시 반드시 커밋합니다 (커밋 메시지는 `orch: `로 시작)
4. **push 금지**: 워커는 절대 remote에 push하지 않습니다
5. **merge 수동**: merge는 사용자가 결과 확인 후 직접 진행합니다
6. **세션 네이밍**: 모든 tmux 세션은 `wt_worker_` 접두사를 사용합니다
7. **정리 보류**: tmux 세션, worktree, 브랜치 모두 사용자 요청 전까지 유지합니다
8. **최대 5개**: 워커는 최대 5개까지만 생성합니다
9. **에러 처리**: 워커가 실패해도 다른 워커는 계속 진행합니다
