export const DEFAULT_TASK_COLOR = '#3b82f6'
export const UNLABELED_VALUE = '__unlabeled__'

// --- 基準ピクセル・サイズ定数 ---
export const DEFAULT_PX_PER_DAY = 28
export const DEFAULT_PX_PER_MONTH = 40
export const DEFAULT_PX_PER_HOUR = 140
export const DEFAULT_ROW_HEADER_WIDTH = 200
export const DEFAULT_BAR_HEIGHT = 38

// --- ズーム範囲定数 ---
// DisplaySettingsMenu のスライダーと GanttChartOption.zoom で共通利用する

/** ガントチャート全体の表示倍率設定（%） */
export const ZOOM_PERCENT = { min: 50, max: 200, step: 5, default: 100 } as const

/** 日単位モードのズーム設定 */
export const ZOOM_DAILY = { min: 10, max: 80, step: 5 } as const

/** 月単位モードのズーム設定 */
export const ZOOM_MONTHLY = { min: 10, max: 80, step: 5 } as const

/** 時間単位モードのズーム設定（pxPerHour 基準） */
export const ZOOM_HOURLY = { min: 50, max: 300, step: 50 } as const

/** カレンダーの横幅プリセット（極小・小・中・大・特大） */
export const CALENDAR_WIDTH_PRESETS = {
  daily: [
    { label: '極小', value: 14 },
    { label: '小', value: 20 },
    { label: '中', value: 28 },
    { label: '大', value: 40 },
    { label: '特大', value: 56 },
  ],
  monthly: [
    { label: '極小', value: 20 },
    { label: '小', value: 30 },
    { label: '中', value: 40 },
    { label: '大', value: 60 },
    { label: '特大', value: 80 },
  ],
  hourly: [
    { label: '極小', value: 60 },
    { label: '小', value: 100 },
    { label: '中', value: 140 },
    { label: '大', value: 200 },
    { label: '特大', value: 280 },
  ],
} as const

