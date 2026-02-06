---
description: "tmux 워커를 오른쪽 pane에 직접 생성해 작업을 병렬 처리합니다"
allowed-tools: ["Bash", "Read", "Write", "Edit"]
---

# 워커 오케스트레이션

사용자의 요청을 분석하고, 여러 워커 Claude에게 병렬로 분배한 뒤, 결과를 통합합니다.

## 작업 요청

$ARGUMENTS

## 실행 절차

아래 단계를 **정확히** 따라 실행합니다.

---

### STEP 1: 작업 분해

위 `$ARGUMENTS` 내용을 분석해서 **독립적으로 수행 가능한 하위 작업**으로 분해합니다.

분해 기준:
- 서로 다른 파일/폴더를 대상으로 하는 작업끼리 분리
- 하나의 워커가 하나의 명확한 작업만 수행
- 최대 5개까지만 분해 (Max 플랜 한도 고려)
- 작업 특성에 따라 1~5개로 유연하게 분해 (고정된 수가 아님)

분해 결과를 터미널에 출력합니다:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 워커 오케스트레이션 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 작업 요청: $ARGUMENTS"
echo ""
echo "📦 하위 작업 분해:"
# 실제 분해된 워커 수만큼만 출력 (아래는 예시)
echo "  [워커 0] 실제 작업 내용"
# 워커가 2개 이상인 경우에만 추가
echo "  [워커 1] 실제 작업 내용"
echo ""
```

---

### STEP 2: 환경 준비

기존 오케스트레이션 잔여물을 정리하고 결과 디렉토리를 준비합니다:

```bash
# 이전 실행 잔여물 정리
for s in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^orch_worker_'); do
  tmux kill-session -t "$s" 2>/dev/null
done
# 이전 워커 pane 정리
for f in /tmp/orch_pane_*; do
  tmux kill-pane -t "$(cat $f)" 2>/dev/null
done
rm -f /tmp/orch_result_*.md /tmp/orch_done_* /tmp/orch_pane_*

echo "✅ 환경 준비 완료"
```

---

### STEP 3: 워커 생성 및 작업 전달

각 워커마다 아래를 실행합니다. **워커 번호는 0부터 시작합니다.**

#### tmux 환경인 경우: 오른쪽 pane에 워커를 직접 생성

워커의 실제 출력이 오른쪽에 직접 보이도록 split pane으로 생성합니다.

```bash
if [ -n "$TMUX" ]; then
  # === 워커 0: 오른쪽 40% 영역 생성 ===
  PANE_0=$(tmux split-window -h -p 40 -P -F '#{pane_id}' \
    "claude -p '

[여기에 워커 0의 하위 작업 내용을 구체적으로 작성]

규칙:
1. 작업 결과를 /tmp/orch_result_0.md 에 저장할 것
2. 결과 파일 형식:
   ## 상태
   성공 또는 실패

   ## 요약
   작업 내용 요약 (3줄 이내)

   ## 상세 내용
   구체적인 변경 사항이나 분석 결과

   ## 변경된 파일
   - 파일경로1
   - 파일경로2
3. 작업이 끝나면 반드시 /tmp/orch_done_0 파일을 생성할 것: touch /tmp/orch_done_0

' --allowedTools 'Read,Write,Edit,Bash' && touch /tmp/orch_done_0")
  tmux set-option -p -t "$PANE_0" remain-on-exit on
  echo "$PANE_0" > /tmp/orch_pane_0
  echo "🔧 [워커 0] 오른쪽 pane에 생성 완료"

  # === 워커 1 이상: 오른쪽 영역을 수직 분할 ===
  # (워커가 2개 이상인 경우에만 아래를 추가)
  PANE_1=$(tmux split-window -v -t "$PANE_0" -p 50 -P -F '#{pane_id}' \
    "claude -p '

[여기에 워커 1의 하위 작업 내용을 구체적으로 작성]

규칙:
1. 작업 결과를 /tmp/orch_result_1.md 에 저장할 것
2. 결과 파일 형식:
   ## 상태
   성공 또는 실패

   ## 요약
   작업 내용 요약 (3줄 이내)

   ## 상세 내용
   구체적인 변경 사항이나 분석 결과

   ## 변경된 파일
   - 파일경로1
   - 파일경로2
3. 작업이 끝나면 반드시 /tmp/orch_done_1 파일을 생성할 것: touch /tmp/orch_done_1

' --allowedTools 'Read,Write,Edit,Bash' && touch /tmp/orch_done_1")
  tmux set-option -p -t "$PANE_1" remain-on-exit on
  echo "$PANE_1" > /tmp/orch_pane_1
  echo "🔧 [워커 1] 오른쪽 pane에 생성 완료"

  # === 워커 2 이상: 같은 패턴으로 수직 분할 계속 ===
  # PANE_2=$(tmux split-window -v -t "$PANE_1" -p 50 -P -F '#{pane_id}' "claude -p '...' && touch /tmp/orch_done_2")
  # tmux set-option -p -t "$PANE_2" remain-on-exit on
  # echo "$PANE_2" > /tmp/orch_pane_2

fi
```

레이아웃 구조:
```
1개 워커:
┌──────────────────┬──────────────┐
│ Main (60%)       │ Worker 0     │
│ (Claude Code)    │ (실제 출력)   │
└──────────────────┴──────────────┘

2개 워커:
┌──────────────────┬──────────────┐
│                  │ Worker 0     │
│ Main (60%)       ├──────────────┤
│                  │ Worker 1     │
└──────────────────┴──────────────┘

3개 워커:
┌──────────────────┬──────────────┐
│                  │ Worker 0     │
│ Main (60%)       ├──────────────┤
│                  │ Worker 1     │
│                  ├──────────────┤
│                  │ Worker 2     │
└──────────────────┴──────────────┘
```

#### 비-tmux 환경인 경우: 백그라운드 세션으로 폴백

```bash
if [ -z "$TMUX" ]; then
  echo "⚠️ tmux 환경이 아닙니다. 백그라운드 세션으로 워커를 생성합니다."
  echo "💡 팁: tmux 안에서 실행하면 오른쪽 pane에 워커 실제 출력이 표시됩니다."

  # 워커 N 생성
  tmux new-session -d -s orch_worker_N

  # 워커 N에게 작업 전달
  tmux send-keys -t orch_worker_N 'claude -p "

[여기에 하위 작업 내용을 구체적으로 작성]

규칙:
1. 작업 결과를 /tmp/orch_result_N.md 에 저장할 것
2. 결과 파일 형식:
   ## 상태
   성공 또는 실패

   ## 요약
   작업 내용 요약 (3줄 이내)

   ## 상세 내용
   구체적인 변경 사항이나 분석 결과

   ## 변경된 파일
   - 파일경로1
   - 파일경로2
3. 작업이 끝나면 반드시 /tmp/orch_done_N 파일을 생성할 것: touch /tmp/orch_done_N

" --allowedTools "Read,Write,Edit,Bash" && touch /tmp/orch_done_N' Enter

  echo "🔧 [워커 N] 백그라운드 세션 생성 완료 → 작업 전달됨"
fi
```

---

### STEP 4: 완료 대기

워커 완료를 대기합니다.

```bash
TOTAL=N        # 총 워커 수
TIMEOUT=300    # 5분 타임아웃
ELAPSED=0
IS_TMUX_PANE=""
[ -n "$TMUX" ] && IS_TMUX_PANE="true"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ 전체 워커 ${TOTAL}개 실행 중... 완료까지 대기합니다"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while [ $ELAPSED -lt $TIMEOUT ]; do
    DONE=$(ls /tmp/orch_done_* 2>/dev/null | wc -l | tr -d ' ')

    if [ "$DONE" -ge "$TOTAL" ]; then
        echo ""
        echo "🎉 모든 워커가 완료되었습니다!"
        break
    fi

    if [ -n "$IS_TMUX_PANE" ]; then
        # tmux pane 모드: 워커 출력이 오른쪽에 직접 보이므로 간략하게
        echo "  ⏳ [${ELAPSED}s] ${DONE}/${TOTAL} 완료... (오른쪽 pane에서 실시간 확인)"
    else
        # 비-tmux 모드: 상세 상태 표시
        STATUS=""
        for i in $(seq 0 $((TOTAL - 1))); do
            if [ -f /tmp/orch_done_$i ]; then
                STATUS="$STATUS  ✅ [워커 $i] 완료"
            else
                LAST_LINE=$(tmux capture-pane -t orch_worker_$i -p 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-60)
                STATUS="$STATUS  ⏳ [워커 $i] 작업중... $LAST_LINE"
            fi
        done

        echo ""
        echo "── [${ELAPSED}s] 진행 상황: ${DONE}/${TOTAL} 완료 ──"
        echo "$STATUS"
    fi

    sleep 10
    ELAPSED=$((ELAPSED + 10))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo "⚠️  타임아웃! 일부 워커가 완료되지 않았습니다."
    for i in $(seq 0 $((TOTAL - 1))); do
        if [ ! -f /tmp/orch_done_$i ]; then
            echo "  ❌ [워커 $i] 미완료"
        fi
    done
fi
```

---

### STEP 5: 결과 수집 및 통합

워커 pane을 종료하고 결과를 수집합니다:

```bash
# 워커 pane 종료
for f in /tmp/orch_pane_*; do
  tmux kill-pane -t "$(cat $f)" 2>/dev/null
done
rm -f /tmp/orch_pane_*
echo "📺 워커 pane 정리 완료"

# 비-tmux 환경: 백그라운드 세션 정리
for s in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^orch_worker_'); do
  tmux kill-session -t "$s" 2>/dev/null
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 결과 수집 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

각 `/tmp/orch_result_N.md` 파일을 Read 도구로 읽습니다.
모든 결과를 종합해서 사용자에게 **하나의 통합 보고서**로 제공합니다.

보고서 형식:
```
🚀 오케스트레이션 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━

총 워커: N개 | 성공: X개 | 실패: Y개

[워커 0] ✅ 작업 요약 한 줄
[워커 1] ✅ 작업 요약 한 줄
...

상세 내용:
(각 워커의 결과를 정리)
```

---

### STEP 6: 현재 상태 안내

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 오케스트레이션 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 결과 파일:"
ls -la /tmp/orch_result_*.md 2>/dev/null
echo ""
echo "💡 수동 정리 명령어:"
echo "  파일 삭제:  rm -f /tmp/orch_result_*.md /tmp/orch_done_*"
echo ""
```

---

## 중요 규칙

1. **워커 격리**: 각 워커는 절대 다른 워커의 담당 파일을 수정하지 않습니다
2. **컨텍스트 전달**: 워커 프롬프트에 프로젝트의 언어, 프레임워크, 컨벤션을 반드시 포함합니다
3. **완료 신호**: 워커는 작업 완료 시 반드시 `touch /tmp/orch_done_N`을 실행합니다
4. **에러 처리**: 워커가 실패해도 다른 워커는 계속 진행합니다
5. **유연한 워커 수**: 작업 특성에 맞게 1~5개로 유연하게 분해 (고정된 수가 아님)
6. **워커 pane 표시**: tmux 환경에서는 오른쪽 pane에 워커의 실제 출력이 직접 표시됩니다
7. **비-tmux 폴백**: tmux가 아닌 환경에서는 백그라운드 세션으로 자동 전환됩니다
