export const DEFAULT_TASK_COLOR = '#3b82f6'
export const UNLABELED_VALUE = '__unlabeled__'

// --- ズーム範囲定数 ---
// DisplaySettingsMenu のスライダーと GanttChartOption.zoom で共通利用する

/** 日単位モードのズーム設定 */
export const ZOOM_DAILY = { min: 10, max: 80, step: 5 } as const

/** 月単位モードのズーム設定 */
export const ZOOM_MONTHLY = { min: 10, max: 80, step: 5 } as const

/** 時間単位モードのズーム設定（pxPerHour 基準） */
export const ZOOM_HOURLY = { min: 50, max: 300, step: 50 } as const
