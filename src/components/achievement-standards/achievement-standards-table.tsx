'use client'

import { useState, useMemo } from 'react'
import { DataTable } from '@/components/data-table/data-table'
import {
  createAchievementStandardColumns,
  type AchievementStandard,
} from './columns'
import { AchievementStandardsToolbar } from './toolbar'
import { FormDialog } from './form-dialog'
import { DeactivateDialog } from './deactivate-dialog'
import { DetailSheet } from './detail-sheet'

// ─── 타입 ──────────────────────────────────────────────

interface AchievementStandardsTableProps {
  readonly data: AchievementStandard[]
  readonly isSystemAdmin: boolean
}

// ─── 클라이언트 래퍼 (Dialog 상태 관리) ─────────────────

export function AchievementStandardsTable({
  data,
  isSystemAdmin,
}: AchievementStandardsTableProps) {
  // 상세 Sheet 상태
  const [selectedStandard, setSelectedStandard] =
    useState<AchievementStandard | null>(null)

  // 수정 Dialog 상태
  const [editTarget, setEditTarget] = useState<AchievementStandard | null>(null)

  // 비활성화 Dialog 상태
  const [deactivateTarget, setDeactivateTarget] =
    useState<AchievementStandard | null>(null)

  // 컬럼 팩토리 — 콜백 메모이제이션
  const columns = useMemo(
    () =>
      createAchievementStandardColumns({
        isSystemAdmin,
        onView: (standard) => setSelectedStandard(standard),
        onEdit: (standard) => setEditTarget(standard),
        onDeactivate: (standard) => setDeactivateTarget(standard),
      }),
    [isSystemAdmin]
  )

  return (
    <>
      {/* 상세 Sheet */}
      <DetailSheet
        open={!!selectedStandard}
        onOpenChange={(open) => {
          if (!open) setSelectedStandard(null)
        }}
        standard={selectedStandard}
      />

      <DataTable
        columns={columns}
        data={data}
        toolbar={<AchievementStandardsToolbar />}
        noResultsMessage="등록된 성취기준이 없습니다."
      />

      {/* 수정 Dialog (제어 모드) */}
      {editTarget && (
        <FormDialog
          mode="edit"
          initialData={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
          key={editTarget.id}
        />
      )}

      {/* 비활성화 AlertDialog */}
      {deactivateTarget && (
        <DeactivateDialog
          standardId={deactivateTarget.id}
          standardCode={deactivateTarget.code}
          open={!!deactivateTarget}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null)
          }}
        />
      )}
    </>
  )
}
