#!/bin/bash
# UserPromptSubmit Hook: 매 프롬프트마다 체크리스트 리마인더를 Claude 컨텍스트에 주입
# stdout 출력 → Claude가 읽는 컨텍스트에 자동 삽입

echo "리마인더: 응답 첫 줄에 CLAUDE.md의 해당 체크리스트(계획/구현/학습)를 복사·체크하며 시작할 것. 체크리스트 없는 응답은 규칙 위반이다."
exit 0
