#!/bin/bash
# Stop Hook: Claude 응답에 체크리스트가 포함되었는지 검증
#
# Stop Hook이 받는 stdin JSON:
# {
#   "session_id": "...",
#   "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
#   "cwd": "...",
#   "hook_event_name": "Stop",
#   "stop_hook_active": false
# }
#
# Claude의 응답 텍스트는 stdin에 없음 → transcript 파일에서 읽어야 함

# 1. stdin에서 transcript 경로 추출
INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# transcript 경로가 없으면 통과
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# 2. transcript(JSONL)에서 마지막 assistant 메시지 추출
LAST_RESPONSE=$(tail -20 "$TRANSCRIPT" | grep '"role":"assistant"' | tail -1)

# assistant 메시지가 없으면 통과
if [ -z "$LAST_RESPONSE" ]; then
  exit 0
fi

# 3. 체크리스트 패턴 확인
if echo "$LAST_RESPONSE" | grep -q "체크리스트:"; then
  exit 0
fi

# 4. 체크리스트 누락 → JSON으로 차단
echo '{"decision":"block","reason":"⛔ 체크리스트가 누락되었습니다. CLAUDE.md의 해당 체크리스트(계획/구현/학습)를 응답 첫 줄에 복사·체크하며 시작하세요."}'
exit 0
