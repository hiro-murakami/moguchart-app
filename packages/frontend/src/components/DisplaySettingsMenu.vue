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

const handleCalendarWidthChange = (val: number) => {
  if (val == null) return
  if (currentGranularity.value === 'monthly') {
    emit('update:basePxPerMonth', val)
  } else if (currentGranularity.value === 'hourly') {
    emit('update:basePxPerHour', val)
  } else {
    emit('update:basePxPerDay', val)
  }
}

const selectedCalendarWidth = computed<number>(() => {
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

const selectedBarHeight = computed(() => {
  const current = currentBaseBarHeight.value
  const found = BAR_HEIGHT_PRESETS.find((p) => p.value === current)
  if (found) return current
  return 38
})

const handleBarHeightChange = (val: number) => {
  if (val == null) return
  emit('update:baseBarHeight', val)
  emit('update:barHeight', val)
}

// --- バーの影 ---
const BAR_SHADOW_PRESETS = [
  { label: 'なし', value: 'none' as const },
  { label: '小', value: 'small' as const },
  { label: '中', value: 'medium' as const },
  { label: '大', value: 'large' as const },
]

const selectedBarShadow = computed(() => {
  const current = props.barShadowLevel
  const found = BAR_SHADOW_PRESETS.find((p) => p.value === current)
  return found ? current : 'medium'
})

const handleBarShadowChange = (val: 'none' | 'small' | 'medium' | 'large') => {
  if (val != null) emit('update:barShadowLevel', val)
}

const userStore = useUserStore()
const user = computed(() => userStore.user)
const isPublicViewMode = inject<Ref<boolean>>('isPublicViewMode', ref(false))
/** App.vue から provide された公開閲覧モード用テーマオーバーライド */
const publicThemeOverride = inject<Ref<'light' | 'dark' | 'system' | null>>('publicThemeOverride', ref(null))

const themeOptions = [
  { title: 'ライト', value: 'light', image: themeLightImg },
  { title: 'ダーク', value: 'dark', image: themeDarkImg },
  { title: 'システム', value: 'system', image: themeSystemImg },
]

const currentTheme = computed({
  get: () => {
    if (isPublicViewMode.value) return publicThemeOverride.value || 'system'
    return user.value?.attribute?.theme || 'system'
  },
  set: async (val: 'light' | 'dark' | 'system') => {
    if (isPublicViewMode.value) {
      // 公開閲覧モード: App.vue の publicThemeOverride を更新
      // → effectiveTheme → <v-app :theme> に反映される
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
    <v-card min-width="320" class="pa-4">
      <div class="text-subtitle-2 mb-3">表示設定</div>
      <v-switch
        :model-value="showHiddenRows"
        label="非表示行を表示"
        color="primary"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:showHiddenRows', $event as boolean)"
      />
      <v-switch
        :model-value="showCurrentTimeLine"
        label="現在時刻線を表示"
        color="primary"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:showCurrentTimeLine', $event as boolean)"
      />
      <v-switch
        v-if="canEdit"
        :model-value="readonlyMode"
        label="読み取り専用モード"
        color="primary"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:readonlyMode', $event as boolean)"
      />
      <v-switch
        :model-value="showCriticalPath"
        label="クリティカルパスを表示"
        color="error"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:showCriticalPath', $event as boolean)"
      />
      <v-switch
        :model-value="showSummaryTasks"
        label="サマリータスクを表示"
        color="primary"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:showSummaryTasks', $event as boolean)"
      />
      <div class="d-flex align-center justify-space-between mb-2">
        <v-switch
          :model-value="showMinimap"
          label="ミニマップを表示"
          color="primary"
          hide-details
          density="compact"
          class="flex-grow-0 text-no-wrap"
          @update:model-value="emit('update:showMinimap', $event as boolean)"
        />
        <div v-if="showMinimap" class="d-flex align-center">
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
          <v-tooltip text="不透明度" location="top">
            <template #activator="{ props: tooltipProps }">
              <span
                v-bind="tooltipProps"
                class="setting-value-text d-flex align-center justify-center px-1 cursor-default"
              >
                {{ Math.round((minimapOpacity ?? 1) * 100) }}%
              </span>
            </template>
          </v-tooltip>
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

      <!-- Chrome風 設定項目グループ（ズーム、カレンダーの横幅、バーの高さ、バーの影） -->
      <div class="chrome-settings-group my-2">
        <!-- ズーム -->
        <div class="chrome-setting-row d-flex align-center justify-space-between py-2 px-1">
          <div class="d-flex align-center" style="gap: 10px">
            <v-icon size="18" color="medium-emphasis">mdi-magnify-plus-outline</v-icon>
            <span class="text-body-2 font-weight-medium">ズーム</span>
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
            <div class="setting-divider mx-2"></div>
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
        <div class="chrome-setting-row d-flex align-center justify-space-between py-2 px-1">
          <div class="d-flex align-center" style="gap: 10px">
            <v-icon size="18" color="medium-emphasis">mdi-arrow-expand-horizontal</v-icon>
            <span class="text-body-2 font-weight-medium">カレンダーの横幅</span>
          </div>
          <v-select
            :model-value="selectedCalendarWidth"
            :items="calendarPresets"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="setting-select"
            @update:model-value="(v: number) => handleCalendarWidthChange(v)"
          />
        </div>

        <!-- バーの高さ -->
        <div class="chrome-setting-row d-flex align-center justify-space-between py-2 px-1">
          <div class="d-flex align-center" style="gap: 10px">
            <v-icon size="18" color="medium-emphasis">mdi-arrow-expand-vertical</v-icon>
            <span class="text-body-2 font-weight-medium">バーの高さ</span>
          </div>
          <v-select
            :model-value="selectedBarHeight"
            :items="BAR_HEIGHT_PRESETS"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="setting-select"
            @update:model-value="(v: number) => handleBarHeightChange(v)"
          />
        </div>

        <!-- バーの影 -->
        <div class="chrome-setting-row d-flex align-center justify-space-between py-2 px-1">
          <div class="d-flex align-center" style="gap: 10px">
            <v-icon size="18" color="medium-emphasis">mdi-box-shadow</v-icon>
            <span class="text-body-2 font-weight-medium">バーの影</span>
          </div>
          <v-select
            :model-value="selectedBarShadow"
            :items="BAR_SHADOW_PRESETS"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="setting-select"
            @update:model-value="(v: 'none' | 'small' | 'medium' | 'large') => handleBarShadowChange(v)"
          />
        </div>
      </div>

      <div class="text-caption text-medium-emphasis mt-3 mb-1">テーマ</div>
      <v-radio-group v-model="currentTheme" inline hide-details class="mb-3 d-flex justify-center">
        <v-radio v-for="option in themeOptions" :key="option.value" :value="option.value">
          <template v-slot:label>
            <div class="d-flex flex-column align-center ma-1 mt-2 cursor-pointer">
              <img
                :src="option.image"
                width="64"
                :alt="option.title"
                style="border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)"
              />
              <span class="mt-2 text-caption">{{ option.title }}</span>
            </div>
          </template>
        </v-radio>
      </v-radio-group>
    </v-card>
  </v-menu>
</template>

<style scoped>
.chrome-settings-group {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.chrome-setting-row {
  user-select: none;
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
  min-width: 48px !important;
  height: 28px !important;
  font-weight: 500;
  font-size: 13px !important;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

.setting-divider {
  width: 1px;
  height: 18px;
  background-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.setting-select {
  max-width: 120px;
}

.setting-select :deep(.v-field__input) {
  min-height: 32px !important;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  padding-left: 10px !important;
  padding-right: 6px !important;
  font-size: 13px !important;
}

.setting-select :deep(.v-field__append-inner) {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}

.setting-select :deep(.v-field) {
  border-radius: 8px !important;
}
</style>
