<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import {
  DEPENDENCY_TYPE_OPTIONS,
  granularityToInputType,
  LAG_UNIT_OPTIONS,
  lagValueAndUnitToMinutes,
  minutesToLagValueAndUnit,
  normalizeTaskDependency,
  toTaskDependencyEntry,
  type LagUnit,
} from '@/modules/utils'
import type {
  ColorPalette,
  DependencyType,
  EditingTaskData,
  Label,
  ProjectGranularity,
  SimpleRowData,
  TaskDependency,
  User,
} from '@functions/types/shared'
import dayjs from 'dayjs'
import { cloneDeep, isEqual } from 'lodash'
import { computed, ref, watch } from 'vue'

interface EditableDependencyItem {
  taskId: string
  type: DependencyType
  lagValue: number
  lagUnit: LagUnit
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    task: EditingTaskData
    rows: SimpleRowData[]
    granularity?: ProjectGranularity
    enableProgress?: boolean
    users?: User[]
  }>(),
  {
    enableProgress: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', task: EditingTaskData): void
}>()

const buildEditableDependencies = (deps?: TaskDependency[]): EditableDependencyItem[] => {
  if (!deps || deps.length === 0) return []
  return deps.map((dep) => {
    const normalized = normalizeTaskDependency(dep)
    const { value, unit } = minutesToLagValueAndUnit(normalized.lag, props.granularity)
    return {
      taskId: normalized.taskId,
      type: normalized.type,
      lagValue: value,
      lagUnit: unit,
    }
  })
}

const localTask = ref<EditingTaskData>(cloneDeep(props.task))
const localDependencies = ref<EditableDependencyItem[]>(buildEditableDependencies(props.task.dependencies))
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.task,
  (newVal) => {
    localTask.value = cloneDeep(newVal)
    localDependencies.value = buildEditableDependencies(newVal.dependencies)
  },
  { deep: true },
)

const syncDependenciesToLocalTask = () => {
  const seen = new Set<string>()
  const validEntries: TaskDependency[] = []
  for (const item of localDependencies.value) {
    if (!item.taskId || seen.has(item.taskId)) continue
    seen.add(item.taskId)
    validEntries.push(
      toTaskDependencyEntry(
        item.taskId,
        item.type,
        lagValueAndUnitToMinutes(item.lagValue, item.lagUnit),
      ),
    )
  }
  localTask.value.dependencies = validEntries.length > 0 ? validEntries : undefined
}

watch(
  localDependencies,
  () => {
    syncDependenciesToLocalTask()
  },
  { deep: true },
)

// 先行タスク候補一覧（自分自身とサマリータスクを除外）
const allTaskOptions = computed(() => {
  const options: { value: string; title: string }[] = []
  for (const row of props.rows) {
    if (!row.tasks) continue
    for (const t of row.tasks) {
      const tId = String(t.id)
      if (t.type === 'summary' || tId.endsWith('-summary')) continue
      if (props.task.id && tId === String(props.task.id)) continue
      const taskName = t.name || '（名称なし）'
      options.push({
        value: tId,
        title: `${row.name} / ${taskName}`,
      })
    }
  }
  return options
})

const getTaskOptionsForIndex = (index: number) => {
  const usedIds = new Set(
    localDependencies.value
      .map((item, i) => (i !== index ? item.taskId : ''))
      .filter(Boolean),
  )
  return allTaskOptions.value.filter((opt) => !usedIds.has(opt.value))
}

const canAddDependency = computed(() => {
  const usedIds = new Set(localDependencies.value.map((item) => item.taskId).filter(Boolean))
  return allTaskOptions.value.some((opt) => !usedIds.has(opt.value))
})

const addDependencyRow = () => {
  const usedIds = new Set(localDependencies.value.map((item) => item.taskId).filter(Boolean))
  const firstAvailable = allTaskOptions.value.find((opt) => !usedIds.has(opt.value))
  const defaultUnit: LagUnit = props.granularity === 'hourly' ? 'hours' : 'days'
  localDependencies.value.push({
    taskId: firstAvailable?.value || '',
    type: 'FS',
    lagValue: 0,
    lagUnit: defaultUnit,
  })
}

const removeDependencyRow = (index: number) => {
  localDependencies.value.splice(index, 1)
}

const hasChanges = computed(() => {
  return !isEqual(props.task, localTask.value)
})

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const save = () => {
  syncDependenciesToLocalTask()
  emit('save', localTask.value)
}

const onUpdateColorPalette = (val: ColorPalette | undefined) => {
  localTask.value.colorPalette = val
}

const onUpdateLabels = (val: Label[]) => {
  localTask.value.labels = val
}

// 担当者の管理
const localAssignees = computed({
  get: () => localTask.value.assignees || [],
  set: (val: string[]) => {
    localTask.value.assignees = val.length > 0 ? val : undefined
  },
})

// ロック状態の管理
const isLocked = computed({
  get: () => !!localTask.value.lock,
  set: (val: boolean) => {
    localTask.value.lock = val || undefined
  },
})

const isMonthly = computed(() => props.granularity === 'monthly')
const isHourly = computed(() => props.granularity === 'hourly')

const displayEnd = computed({
  get: () => {
    if (!localTask.value.end) return ''
    if (isMonthly.value) {
      return dayjs(localTask.value.end).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
    }
    if (!isHourly.value) {
      // 日単位の場合、ガントバーの終了日時が0時0分の時は前日の日付で表示
      const endDate = dayjs(localTask.value.end)
      const startDate = localTask.value.start ? dayjs(localTask.value.start) : null
      if (
        endDate.isValid() &&
        endDate.hour() === 0 &&
        endDate.minute() === 0 &&
        (!startDate || startDate.isBefore(endDate))
      ) {
        return endDate.subtract(1, 'day').format('YYYY-MM-DD')
      }
      return endDate.format('YYYY-MM-DD')
    }
    return localTask.value.end
  },
  set: (val: string) => {
    if (!val) {
      localTask.value.end = ''
      return
    }
    if (isMonthly.value) {
      localTask.value.end = dayjs(val).add(1, 'month').startOf('month').format('YYYY-MM-DD')
    } else if (!isHourly.value) {
      // 日単位の場合、ユーザーが入力した終了日（その日いっぱい）の翌日0時0分（半開区間の終端）として格納
      localTask.value.end = dayjs(val).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
    } else {
      localTask.value.end = val
    }
  },
})

const inputType = computed(() => granularityToInputType(props.granularity))
</script>

<template>
  <TaskFormDialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="タスク編集"
    v-model:name="localTask.name"
    :color-palette="localTask.colorPalette"
    @update:color-palette="onUpdateColorPalette"
    :labels="localTask.labels"
    @update:labels="onUpdateLabels"
    v-model:description="localTask.description"
    @save="save"
    @close="close"
  >
    <template #extra-fields>
      <v-col cols="12">
        <v-select
          v-model="localTask.rowId"
          :items="rows"
          item-title="name"
          item-value="id"
          label="行"
          density="compact"
          variant="outlined"
          hide-details
          autocomplete="off"
          class="mb-3"
        ></v-select>
      </v-col>
      <UsersInput
        v-model="localAssignees"
        label="担当者"
        help-text="指定されたユーザーは、進捗率を変更できるようになります"
        :users="props.users"
      />
      <v-col :cols="props.enableProgress ? 4 : 6">
        <DateInput
          v-model="localTask.start"
          :type="inputType"
          label-daily="開始日"
          label-monthly="開始月"
          label-datetime="開始日時"
          :compare-target="displayEnd"
          compare-rule="before"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col :cols="props.enableProgress ? 4 : 6">
        <DateInput
          v-model="displayEnd"
          :type="inputType"
          label-daily="終了日"
          label-monthly="終了月"
          label-datetime="終了日時"
          :compare-target="localTask.start"
          compare-rule="after"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col v-if="props.enableProgress" cols="4">
        <v-number-input
          v-model="localTask.progress"
          label="進捗率"
          :min="0"
          :max="100"
          :step="5"
          density="compact"
          variant="outlined"
          control-variant="stacked"
          hide-details
          suffix="%"
          class="mb-3"
          clearable
          autocomplete="off"
        />
      </v-col>

      <!-- 先行タスク（接続線）の設定 -->
      <v-col cols="12" class="mb-3">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-caption font-weight-bold">先行タスク（接続線）</span>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            :disabled="!canAddDependency"
            @click="addDependencyRow"
          >
            先行タスクを追加
          </v-btn>
        </div>

        <div
          v-if="localDependencies.length === 0"
          class="text-caption text-medium-emphasis py-1"
        >
          先行タスクは設定されていません
        </div>

        <v-row
          v-for="(dep, index) in localDependencies"
          :key="index"
          density="compact"
          align="center"
          class="mb-2"
        >
          <v-col cols="12" sm="5">
            <v-autocomplete
              v-model="dep.taskId"
              :items="getTaskOptionsForIndex(index)"
              item-title="title"
              item-value="value"
              label="先行タスク"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
            />
          </v-col>
          <v-col cols="5" sm="3">
            <v-select
              v-model="dep.type"
              :items="DEPENDENCY_TYPE_OPTIONS"
              item-title="shortTitle"
              item-value="value"
              label="種別"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="4" sm="2">
            <v-number-input
              v-model="dep.lagValue"
              label="ラグ"
              :step="1"
              density="compact"
              variant="outlined"
              control-variant="stacked"
              hide-details
              autocomplete="off"
            />
          </v-col>
          <v-col cols="2" sm="1">
            <v-select
              v-model="dep.lagUnit"
              :items="LAG_UNIT_OPTIONS"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="1" class="d-flex justify-center">
            <v-btn
              icon="mdi-close"
              size="x-small"
              variant="text"
              color="error"
              title="接続線を削除"
              @click="removeDependencyRow(index)"
            />
          </v-col>
        </v-row>
      </v-col>

      <v-col cols="12">
        <v-switch
          v-model="isLocked"
          label="ロック（移動・リサイズ・削除を禁止）"
          density="compact"
          hide-details
          color="primary"
        ></v-switch>
      </v-col>
    </template>
  </TaskFormDialog>
</template>
