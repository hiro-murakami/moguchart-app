<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { CALENDAR_WIDTH_PRESETS, ZOOM_PERCENT, DEFAULT_BAR_HEIGHT } from '@/modules/constants'
import type { User } from '@functions/types/shared'
import themeDarkImg from '@/assets/theme-dark.png'
import themeLightImg from '@/assets/theme-light.png'
import themeSystemImg from '@/assets/theme-system.png'

const props = defineProps<{
  showHiddenRows: boolean
  showCurrentTimeLine: boolean
  showCriticalPath: boolean
  showSummaryTasks: boolean
  showMinimap: boolean
  minimapOpacity?: number
  barShadowLevel: 'none' | 'small' | 'medium' | 'large'
  readonlyMode?: boolean
  canEdit?: boolean
  zoomPercent?: number
  pxPerDay?: number
  basePxPerDay?: number
  pxPerMonth?: number
  basePxPerMonth?: number
  pxPerHour?: number
  basePxPerHour?: number
  barHeight: number
  baseBarHeight?: number
  granularity?: 'daily' | 'monthly' | 'hourly'
}>()

const emit = defineEmits<{
  'update:showHiddenRows': [value: boolean]
  'update:showCurrentTimeLine': [value: boolean]
  'update:showCriticalPath': [value: boolean]
  'update:showSummaryTasks': [value: boolean]
  'update:showMinimap': [value: boolean]
  'update:minimapOpacity': [value: number]
  'update:barShadowLevel': [value: 'none' | 'small' | 'medium' | 'large']
  'update:readonlyMode': [value: boolean]
  'update:zoomPercent': [value: number]
  'update:pxPerDay': [value: number]
  'update:basePxPerDay': [value: number]
  'update:pxPerMonth': [value: number]
  'update:basePxPerMonth': [value: number]
  'update:pxPerHour': [value: number]
  'update:basePxPerHour': [value: number]
  'update:barHeight': [value: number]
  'update:baseBarHeight': [value: number]
}>()

// --- Chrome風 ズームステップ設定 ---
const CHROME_ZOOM_LEVELS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200]

const handleZoomIn = () => {
  const current = props.zoomPercent ?? 100
  const next = CHROME_ZOOM_LEVELS.find((v) => v > current) ?? ZOOM_PERCENT.max
  emit('update:zoomPercent', Math.min(ZOOM_PERCENT.max, next))
}

const handleZoomOut = () => {
  const current = props.zoomPercent ?? 100
  const prev = [...CHROME_ZOOM_LEVELS].reverse().find((v) => v < current) ?? ZOOM_PERCENT.min
  emit('update:zoomPercent', Math.max(ZOOM_PERCENT.min, prev))
}

// --- ミニマップ不透明度設定 ---
const MINIMAP_OPACITY_LEVELS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

const handleMinimapOpacityIncrease = () => {
  const current = props.minimapOpacity ?? 1
  const next = MINIMAP_OPACITY_LEVELS.find((v) => v > current + 0.001) ?? 1
  emit('update:minimapOpacity', next)
}

const handleMinimapOpacityDecrease = () => {
  const current = props.minimapOpacity ?? 1
  const prev = [...MINIMAP_OPACITY_LEVELS].reverse().find((v) => v < current - 0.001) ?? 0.2
  emit('update:minimapOpacity', prev)
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent)
const resetShortcutText = isMac ? '⌘0' : 'Ctrl+0'

// --- カレンダーの横幅 ---
const currentGranularity = computed(() => props.granularity || 'daily')

const calendarPresets = computed(() => {
  if (currentGranularity.value === 'monthly') return CALENDAR_WIDTH_PRESETS.monthly
  if (currentGranularity.value === 'hourly') return CALENDAR_WIDTH_PRESETS.hourly
  return CALENDAR_WIDTH_PRESETS.daily
})

const currentBaseCalendarWidth = computed(() => {
  if (currentGranularity.value === 'monthly') {
    return props.basePxPerMonth ?? props.pxPerMonth ?? 40
  }
  if (currentGranularity.value === 'hourly') {
    return props.basePxPerHour ?? props.pxPerHour ?? 140
  }
  return props.basePxPerDay ?? props.pxPerDay ?? 28
})

const handleCalendarWidthChange = (val: number | null) => {
  if (val == null) return
  if (currentGranularity.value === 'monthly') {
    emit('update:basePxPerMonth', val)
  } else if (currentGranularity.value === 'hourly') {
    emit('update:basePxPerHour', val)
  } else {
    emit('update:basePxPerDay', val)
  }
}

const selectedCalendarWidth = computed<number>({
  get: () => {
    const current = currentBaseCalendarWidth.value
    const presets = calendarPresets.value
    const found = presets.find((p) => p.value === current)
    if (found) return current
    let closest: number = presets[2]?.value ?? 28
    let minDiff = Infinity
    presets.forEach((p) => {
      const diff = Math.abs(p.value - current)
      if (diff < minDiff) {
        minDiff = diff
        closest = p.value
      }
    })
    return closest
  },
  set: (val: number | null) => {
    if (val != null) handleCalendarWidthChange(val)
  },
})

// --- バーの高さ ---
const BAR_HEIGHT_PRESETS = [
  { label: '極小', value: 24 },
  { label: '小', value: 38 },
  { label: '中', value: 52 },
  { label: '大', value: 66 },
  { label: '特大', value: 80 },
] as const

const currentBaseBarHeight = computed(() => props.baseBarHeight ?? props.barHeight ?? DEFAULT_BAR_HEIGHT)

const selectedBarHeight = computed<number>({
  get: () => {
    const current = currentBaseBarHeight.value
    const found = BAR_HEIGHT_PRESETS.find((p) => p.value === current)
    if (found) return current
    return 38
  },
  set: (val: number | null) => {
    if (val != null) {
      emit('update:baseBarHeight', val)
      emit('update:barHeight', val)
    }
  },
})

// --- バーの影 ---
const BAR_SHADOW_PRESETS = [
  { label: 'なし', value: 'none' as const },
  { label: '小', value: 'small' as const },
  { label: '中', value: 'medium' as const },
  { label: '大', value: 'large' as const },
]

const selectedBarShadow = computed<'none' | 'small' | 'medium' | 'large'>({
  get: () => {
    const current = props.barShadowLevel
    const found = BAR_SHADOW_PRESETS.find((p) => p.value === current)
    return found ? current : 'medium'
  },
  set: (val: 'none' | 'small' | 'medium' | 'large' | null) => {
    if (val != null) emit('update:barShadowLevel', val)
  },
})

const userStore = useUserStore()
const user = computed(() => userStore.user)
const isPublicViewMode = inject<Ref<boolean>>('isPublicViewMode', ref(false))
/** App.vue から provide された公開閲覧モード用テーマオーバーライド */
const publicThemeOverride = inject<Ref<'light' | 'dark' | 'system' | null>>('publicThemeOverride', ref(null))

const themeOptions = [
  { title: 'ライト', value: 'light' as const, image: themeLightImg },
  { title: 'ダーク', value: 'dark' as const, image: themeDarkImg },
  { title: 'システム', value: 'system' as const, image: themeSystemImg },
]

const currentTheme = computed({
  get: () => {
    if (isPublicViewMode.value) return publicThemeOverride.value || 'system'
    return user.value?.attribute?.theme || 'system'
  },
  set: async (val: 'light' | 'dark' | 'system') => {
    if (isPublicViewMode.value) {
      publicThemeOverride.value = val
      return
    }
    if (!user.value) return
    const updatedUser: User = {
      ...user.value,
      attribute: {
        ...user.value.attribute,
        theme: val,
      },
    }
    await userStore.saveUser(updatedUser)
  },
})
</script>

<template>
  <v-menu :close-on-content-click="false" location="bottom end">
    <template #activator="{ props: menuProps }">
      <TutorialOverlay
        :condition="true"
        tutorial-key="displaySetting"
        message="表示倍率・テーマなどを変更できます"
        placement="bottom"
      >
        <template #activator="{ props: overlayProps }">
          <TooltipBtn v-bind="{ ...menuProps, ...overlayProps }" icon="mdi-cog" variant="text" tooltip="表示設定" />
        </template>
      </TutorialOverlay>
    </template>
    <v-card min-width="380" max-width="420" class="pa-4 display-settings-card">
      <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center">
        <v-icon size="22" class="mr-2" color="primary">mdi-tune-variant</v-icon>
        表示設定
      </div>

      <!-- セクション 1: 表示項目 -->
      <div class="section-label">表示項目</div>
      <div class="settings-section mb-1">
        <!-- 非表示行を表示 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-eye-off-outline</v-icon>
            <span class="setting-title">非表示行を表示</span>
          </div>
          <v-switch
            :model-value="showHiddenRows"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:showHiddenRows', $event as boolean)"
          />
        </div>

        <!-- 現在時刻線を表示 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-clock-outline</v-icon>
            <span class="setting-title">現在時刻線を表示</span>
          </div>
          <v-switch
            :model-value="showCurrentTimeLine"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:showCurrentTimeLine', $event as boolean)"
          />
        </div>

        <!-- サマリータスクを表示 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-format-list-group</v-icon>
            <span class="setting-title">サマリータスクを表示</span>
          </div>
          <v-switch
            :model-value="showSummaryTasks"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:showSummaryTasks', $event as boolean)"
          />
        </div>

        <!-- クリティカルパスを表示 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="primary" class="setting-icon">mdi-chart-timeline-variant</v-icon>
            <span class="setting-title">クリティカルパスを表示</span>
          </div>
          <v-switch
            :model-value="showCriticalPath"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:showCriticalPath', $event as boolean)"
          />
        </div>

        <!-- 読み取り専用モード (canEdit時のみ) -->
        <div v-if="canEdit" class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-lock-outline</v-icon>
            <span class="setting-title">読み取り専用モード</span>
          </div>
          <v-switch
            :model-value="readonlyMode"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:readonlyMode', $event as boolean)"
          />
        </div>

        <!-- ミニマップを表示 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-map-outline</v-icon>
            <span class="setting-title">ミニマップを表示</span>
          </div>
          <v-switch
            :model-value="showMinimap"
            color="primary"
            hide-details
            density="compact"
            class="setting-switch"
            @update:model-value="emit('update:showMinimap', $event as boolean)"
          />
        </div>

        <!-- ミニマップ不透明度（ミニマップON時のみインデント表示） -->
        <transition name="expand">
          <div v-if="showMinimap" class="setting-row sub-row">
            <div class="setting-label-group">
              <v-icon size="18" color="medium-emphasis" class="setting-icon">mdi-opacity</v-icon>
              <span class="setting-title sub-title text-medium-emphasis">ミニマップ不透明度</span>
            </div>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                variant="flat"
                density="compact"
                size="small"
                class="setting-round-btn"
                :disabled="Math.round((minimapOpacity ?? 1) * 100) <= 20"
                aria-label="不透明度を下げる"
                @click="handleMinimapOpacityDecrease"
              />
              <span class="setting-value-text d-flex align-center justify-center px-1 cursor-default">
                {{ Math.round((minimapOpacity ?? 1) * 100) }}%
              </span>
              <v-btn
                icon="mdi-plus"
                variant="flat"
                density="compact"
                size="small"
                class="setting-round-btn"
                :disabled="Math.round((minimapOpacity ?? 1) * 100) >= 100"
                aria-label="不透明度を上げる"
                @click="handleMinimapOpacityIncrease"
              />
            </div>
          </div>
        </transition>
      </div>

      <v-divider class="my-3" />

      <!-- セクション 2: サイズ・配置 -->
      <div class="section-label">サイズ・配置</div>
      <div class="settings-section mb-1">
        <!-- ズーム -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-magnify-plus-outline</v-icon>
            <span class="setting-title">ズーム</span>
          </div>
          <div class="d-flex align-center">
            <v-btn
              icon="mdi-minus"
              variant="flat"
              density="compact"
              size="small"
              class="setting-round-btn"
              :disabled="(zoomPercent ?? 100) <= ZOOM_PERCENT.min"
              aria-label="ズームアウト"
              @click="handleZoomOut"
            />
            <TooltipBtn
              :tooltip="(zoomPercent ?? 100) === 100 ? '標準倍率（100%）' : 'クリックで100%にリセット'"
              variant="text"
              density="compact"
              size="small"
              class="setting-value-text px-1 text-none"
              @click="emit('update:zoomPercent', 100)"
            >
              {{ zoomPercent ?? 100 }}%
            </TooltipBtn>
            <v-btn
              icon="mdi-plus"
              variant="flat"
              density="compact"
              size="small"
              class="setting-round-btn"
              :disabled="(zoomPercent ?? 100) >= ZOOM_PERCENT.max"
              aria-label="ズームイン"
              @click="handleZoomIn"
            />
            <div class="setting-divider mx-1"></div>
            <TooltipBtn
              icon="mdi-restore"
              :tooltip="`100%にリセット (${resetShortcutText})`"
              variant="flat"
              density="compact"
              size="small"
              class="setting-round-btn"
              :disabled="(zoomPercent ?? 100) === 100"
              aria-label="100%にリセット"
              @click="emit('update:zoomPercent', 100)"
            />
          </div>
        </div>

        <!-- カレンダーの横幅 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-arrow-expand-horizontal</v-icon>
            <span class="setting-title">カレンダー幅</span>
          </div>
          <v-btn-toggle
            v-model="selectedCalendarWidth"
            mandatory
            density="compact"
            color="primary"
            variant="outlined"
            class="setting-toggle"
          >
            <v-btn
              v-for="preset in calendarPresets"
              :key="preset.value"
              :value="preset.value"
              class="toggle-btn"
            >
              {{ preset.label }}
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- バーの高さ -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-arrow-expand-vertical</v-icon>
            <span class="setting-title">行の高さ</span>
          </div>
          <v-btn-toggle
            v-model="selectedBarHeight"
            mandatory
            density="compact"
            color="primary"
            variant="outlined"
            class="setting-toggle"
          >
            <v-btn
              v-for="preset in BAR_HEIGHT_PRESETS"
              :key="preset.value"
              :value="preset.value"
              class="toggle-btn"
            >
              {{ preset.label }}
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- バーの影 -->
        <div class="setting-row">
          <div class="setting-label-group">
            <v-icon size="20" color="medium-emphasis" class="setting-icon">mdi-box-shadow</v-icon>
            <span class="setting-title">バーの影</span>
          </div>
          <v-btn-toggle
            v-model="selectedBarShadow"
            mandatory
            density="compact"
            color="primary"
            variant="outlined"
            class="setting-toggle"
          >
            <v-btn
              v-for="preset in BAR_SHADOW_PRESETS"
              :key="preset.value"
              :value="preset.value"
              class="toggle-btn"
            >
              {{ preset.label }}
            </v-btn>
          </v-btn-toggle>
        </div>
      </div>

      <v-divider class="my-3" />

      <!-- セクション 3: テーマ -->
      <div class="section-label">テーマ</div>
      <div class="theme-card-group mt-1">
        <div
          v-for="option in themeOptions"
          :key="option.value"
          class="theme-card"
          :class="{ active: currentTheme === option.value }"
          @click="currentTheme = option.value"
        >
          <div class="theme-card-thumbnail-wrapper">
            <img :src="option.image" :alt="option.title" class="theme-card-img" />
            <v-icon
              v-if="currentTheme === option.value"
              size="16"
              color="primary"
              class="theme-check-badge"
            >
              mdi-check-circle
            </v-icon>
          </div>
          <span class="theme-card-title mt-1.5">{{ option.title }}</span>
        </div>
      </div>
    </v-card>
  </v-menu>
</template>

<style scoped>
.display-settings-card {
  user-select: none;
}

.section-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 8px;
  padding-left: 2px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 3px 6px;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.setting-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.setting-row.sub-row {
  min-height: 34px;
  padding-left: 28px;
  background-color: rgba(var(--v-theme-on-surface), 0.02);
}

.setting-label-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.setting-icon {
  flex-shrink: 0;
}

.setting-title {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
}

.setting-title.sub-title {
  font-size: 13px;
}

.setting-switch {
  flex: 0 0 auto;
}

.setting-round-btn {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  border-radius: 50% !important;
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  box-shadow: none !important;
}

.setting-round-btn:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.16) !important;
}

.setting-value-text {
  min-width: 46px !important;
  height: 28px !important;
  font-weight: 600;
  font-size: 13px !important;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

.setting-divider {
  width: 1px;
  height: 16px;
  background-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

/* セグメントボタン */
.setting-toggle {
  height: 30px !important;
  border-radius: 6px !important;
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.setting-toggle .toggle-btn {
  height: 30px !important;
  min-width: 34px !important;
  padding: 0 8px !important;
  font-size: 12px !important;
  font-weight: 500;
  letter-spacing: 0;
}

/* テーマカード選択 */
.theme-card-group {
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.theme-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  border-radius: 8px;
  border: 1.5px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.theme-card.active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.theme-card-thumbnail-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.theme-card-img {
  width: 100%;
  max-width: 90px;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.theme-check-badge {
  position: absolute;
  top: -4px;
  right: -2px;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 50%;
}

.theme-card-title {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.theme-card.active .theme-card-title {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

/* アニメーション */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}
</style>
