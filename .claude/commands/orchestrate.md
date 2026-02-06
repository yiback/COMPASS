---
description: "tmux 워커를 생성해 작업을 병렬 처리하고, 진행 상황을 터미널에 실시간 표시합니다"
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
echo "  [워커 0] 작업 내용..."
echo "  [워커 1] 작업 내용..."
echo "  [워커 N] 작업 내용..."
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
rm -f /tmp/orch_result_*.md /tmp/orch_done_*

echo "✅ 환경 준비 완료"
```

---

### STEP 3: 워커 생성 및 작업 전달

각 워커마다 아래를 실행합니다. **워커 번호는 0부터 시작합니다.**

```bash
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
```

각 워커를 생성할 때마다 터미널에 출력합니다:

```bash
echo "🔧 [워커 N] 세션 생성 완료 → 작업 전달됨"
```

모든 워커 생성이 끝나면:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ 전체 워커 N개 실행 중... 완료까지 대기합니다"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

### STEP 4: 완료 대기 및 실시간 모니터링

10초 간격으로 워커 완료 여부를 확인합니다. **매 확인마다 현재 상태를 터미널에 출력합니다.**

```bash
TOTAL=N        # 총 워커 수
TIMEOUT=300    # 5분 타임아웃
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    DONE=$(ls /tmp/orch_done_* 2>/dev/null | wc -l | tr -d ' ')

    # 각 워커 상태 표시
    STATUS=""
    for i in $(seq 0 $((TOTAL - 1))); do
        if [ -f /tmp/orch_done_$i ]; then
            STATUS="$STATUS  ✅ [워커 $i] 완료"
        else
            # 워커의 현재 활동을 간략히 표시
            LAST_LINE=$(tmux capture-pane -t orch_worker_$i -p 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-60)
            STATUS="$STATUS  ⏳ [워커 $i] 작업중... $LAST_LINE"
        fi
    done

    echo ""
    echo "── [${ELAPSED}s] 진행 상황: ${DONE}/${TOTAL} 완료 ──"
    echo "$STATUS"

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
    for i in $(seq 0 $((TOTAL - 1))); do
        if [ ! -f /tmp/orch_done_$i ]; then
            echo "  ❌ [워커 $i] 미완료"
        fi
    done
fi
```

---

### STEP 5: 결과 수집 및 통합

모든 결과 파일을 읽고 종합 보고를 작성합니다:

```bash
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

### STEP 6: 정리 (반드시 실행)

**이 단계는 성공/실패와 관계없이 항상 실행합니다.**

```bash
# 모든 오케스트레이션 워커 세션 종료
for s in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^orch_worker_'); do
  tmux kill-session -t "$s" 2>/dev/null
done

# 임시 파일 삭제
rm -f /tmp/orch_result_*.md /tmp/orch_done_*

echo ""
echo "🧹 tmux 세션 및 임시 파일 정리 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 오케스트레이션 종료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## 중요 규칙

1. **워커 격리**: 각 워커는 절대 다른 워커의 담당 파일을 수정하지 않습니다
2. **컨텍스트 전달**: 워커 프롬프트에 프로젝트의 언어, 프레임워크, 컨벤션을 반드시 포함합니다
3. **세션 네이밍**: 모든 워커 세션은 `orch_worker_` 접두사를 사용합니다
4. **완료 신호**: 워커는 작업 완료 시 반드시 `touch /tmp/orch_done_N`을 실행합니다
5. **정리 필수**: STEP 6은 어떤 상황에서도 반드시 실행합니다
6. **에러 처리**: 워커가 실패해도 다른 워커는 계속 진행합니다
