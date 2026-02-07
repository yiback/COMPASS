/**
 * 설정 페이지
 * TODO: Phase 0-7에서 구현 예정
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-3xl font-bold">설정</h1>
        <p className="mt-2 text-muted-foreground">
          계정 정보 및 시스템 설정을 관리합니다.
        </p>
      </div>

      {/* TODO: 설정 섹션 */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">프로필 설정</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          설정 기능은 Phase 0-7에서 구현될 예정입니다.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">학원 설정</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          설정 기능은 Phase 0-7에서 구현될 예정입니다.
        </p>
      </div>
    </div>
  )
}
