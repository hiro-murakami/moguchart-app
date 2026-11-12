<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import inputRules from '@/modules/inputRules'
import { formatValueForDateInput, granularityToInputType } from '@/modules/utils'
import type {
  ColorPalette,
  EditingTaskData,
  Label,
  ProjectGranularity,
  SimpleRowData,
  TaskConstraintType,
  User,
} from '@functions/types/shared'
import dayjs from 'dayjs'
import { cloneDeep, isEqual } from 'lodash'
import { computed, nextTick, ref, watch } from 'vue'
import type TaskFormDialog from './TaskFormDialog.vue'

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

const localTask = ref<EditingTaskData>(cloneDeep(props.task))
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.task,
  (newVal) => {
    localTask.value = cloneDeep(newVal)
  },
  { deep: true },
)

const hasChanges = computed(() => {
  return !isEqual(props.task, localTask.value)
})

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const save = () => {
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
const isMilestone = computed(() => localTask.value.type === 'milestone')

const dialogTitle = computed(() => {
  if (localTask.value.id) {
    return isMilestone.value ? 'マイルストーン編集' : 'タスク編集'
  }
  return isMilestone.value ? '新規マイルストーン' : '新規タスク'
})

const taskType = computed<'task' | 'milestone'>({
  get: () => (localTask.value.type === 'milestone' ? 'milestone' : 'task'),
  set: (val: 'task' | 'milestone') => {
    const prevType = localTask.value.type === 'milestone' ? 'milestone' : 'task'
    localTask.value.type = val
    if (val === 'milestone') {
      localTask.value.end = localTask.value.start
      localTask.value.progress = undefined
      if (!localTask.value.id && localTask.value.name === '新規タスク') {
        localTask.value.name = '新規マイルストーン'
      }
      if (prevType !== 'milestone' && !isHourly.value) {
        if (localTask.value.deadline) {
          localTask.value.deadline = isMonthly.value
            ? dayjs(localTask.value.deadline).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
            : dayjs(localTask.value.deadline).subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
        }
        if (localTask.value.constraintType === 'FNLT' && localTask.value.constraintDate) {
          localTask.value.constraintDate = isMonthly.value
            ? dayjs(localTask.value.constraintDate).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
            : dayjs(localTask.value.constraintDate).subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
        }
      }
    } else {
      if (!localTask.value.id && localTask.value.name === '新規マイルストーン') {
        localTask.value.name = '新規タスク'
      }
      if (localTask.value.start) {
        const s = dayjs(localTask.value.start)
        const e = localTask.value.end ? dayjs(localTask.value.end) : null
        if (!e || !s.isBefore(e)) {
          if (isMonthly.value) {
            localTask.value.end = s.startOf('month').add(1, 'month').format('YYYY-MM-DD')
          } else if (isHourly.value) {
            localTask.value.end = s.add(2, 'hour').format('YYYY-MM-DDTHH:mm:ss')
          } else {
            localTask.value.end = s.add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
          }
        }
      }
      if (prevType === 'milestone' && !isHourly.value) {
        if (localTask.value.deadline) {
          localTask.value.deadline = isMonthly.value
            ? dayjs(localTask.value.deadline).add(1, 'month').startOf('month').format('YYYY-MM-DD')
            : dayjs(localTask.value.deadline).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
        }
        if (localTask.value.constraintType === 'FNLT' && localTask.value.constraintDate) {
          localTask.value.constraintDate = isMonthly.value
            ? dayjs(localTask.value.constraintDate).add(1, 'month').startOf('month').format('YYYY-MM-DD')
            : dayjs(localTask.value.constraintDate).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
        }
      }
    }
  },
})

watch(
  () => localTask.value.start,
  (newStart) => {
    if (isMilestone.value && newStart) {
      localTask.value.end = newStart
    }
  },
)

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

const displayDeadline = computed({
  get: () => {
    if (!localTask.value.deadline) return ''
    if (isMilestone.value) {
      return localTask.value.deadline
    }
    if (isMonthly.value) {
      return dayjs(localTask.value.deadline).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
    }
    if (!isHourly.value) {
      const deadlineDate = dayjs(localTask.value.deadline)
      if (deadlineDate.isValid() && deadlineDate.hour() === 0 && deadlineDate.minute() === 0) {
        return deadlineDate.subtract(1, 'day').format('YYYY-MM-DD')
      }
      return deadlineDate.format('YYYY-MM-DD')
    }
    return localTask.value.deadline
  },
  set: (val: string) => {
    if (!val) {
      localTask.value.deadline = undefined
      return
    }
    if (isMilestone.value) {
      localTask.value.deadline = val
    } else if (isMonthly.value) {
      localTask.value.deadline = dayjs(val).add(1, 'month').startOf('month').format('YYYY-MM-DD')
    } else if (!isHourly.value) {
      localTask.value.deadline = dayjs(val).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
    } else {
      localTask.value.deadline = val
    }
  },
})

const constraintTypeOptions = [
  { title: 'なし', value: '' },
  { title: '指定日以降に開始 (SNET)', value: 'SNET' },
  { title: '指定日までに終了 (FNLT)', value: 'FNLT' },
]

const constraintTypeModel = computed<'' | TaskConstraintType>({
  get: () => localTask.value.constraintType || '',
  set: (val: '' | TaskConstraintType) => {
    if (!val) {
      localTask.value.constraintType = undefined
      localTask.value.constraintDate = undefined
      return
    }
    const prevType = localTask.value.constraintType
    localTask.value.constraintType = val
    if (!localTask.value.constraintDate) {
      localTask.value.constraintDate =
        val === 'FNLT' ? localTask.value.end || localTask.value.start : localTask.value.start
    } else if (prevType && prevType !== val && !isMilestone.value && !isHourly.value) {
      if (val === 'FNLT') {
        localTask.value.constraintDate = isMonthly.value
          ? dayjs(localTask.value.constraintDate).add(1, 'month').startOf('month').format('YYYY-MM-DD')
          : dayjs(localTask.value.constraintDate).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
      } else {
        localTask.value.constraintDate = isMonthly.value
          ? dayjs(localTask.value.constraintDate).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
          : dayjs(localTask.value.constraintDate).subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
      }
    }
  },
})

const displayConstraintDate = computed({
  get: () => {
    if (!localTask.value.constraintDate) return ''
    if (localTask.value.constraintType === 'FNLT' && !isMilestone.value) {
      if (isMonthly.value) {
        return dayjs(localTask.value.constraintDate).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
      }
      if (!isHourly.value) {
        const d = dayjs(localTask.value.constraintDate)
        if (d.isValid() && d.hour() === 0 && d.minute() === 0) {
          return d.subtract(1, 'day').format('YYYY-MM-DD')
        }
        return d.format('YYYY-MM-DD')
      }
    }
    return localTask.value.constraintDate
  },
  set: (val: string) => {
    if (!val) {
      localTask.value.constraintDate = undefined
      return
    }
    if (localTask.value.constraintType === 'FNLT' && !isMilestone.value) {
      if (isMonthly.value) {
        localTask.value.constraintDate = dayjs(val).add(1, 'month').startOf('month').format('YYYY-MM-DD')
      } else if (!isHourly.value) {
        localTask.value.constraintDate = dayjs(val).add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
      } else {
        localTask.value.constraintDate = val
      }
    } else {
      localTask.value.constraintDate = val
    }
  },
})

const inputType = computed(() => granularityToInputType(props.granularity))

const taskFormDialogRef = ref<InstanceType<typeof TaskFormDialog> | null>(null)

const activeConstraintDate = computed(() => {
  if (!localTask.value.constraintType || !displayConstraintDate.value) return undefined
  return displayConstraintDate.value
})

const startConstraintMin = computed(() => {
  return localTask.value.constraintType === 'SNET' ? activeConstraintDate.value : undefined
})

const startConstraintMax = computed(() => {
  return localTask.value.constraintType === 'FNLT' ? activeConstraintDate.value : undefined
})

const endConstraintMin = computed(() => {
  return localTask.value.constraintType === 'SNET' ? activeConstraintDate.value : undefined
})

const endConstraintMax = computed(() => {
  return localTask.value.constraintType === 'FNLT' ? activeConstraintDate.value : undefined
})

const constraintTargetLabel = computed(() => {
  if (isMonthly.value) return '制約月'
  if (isHourly.value) return '制約日時'
  return '制約日'
})

const constraintUnitLabel = computed(() => {
  if (isMonthly.value) return '月'
  if (isHourly.value) return '日時'
  return '日付'
})

const startConstraintRules = computed(() => {
  if (!activeConstraintDate.value) return []
  const target = formatValueForDateInput(activeConstraintDate.value, inputType.value)
  if (localTask.value.constraintType === 'SNET') {
    return [inputRules.dateOnOrAfter(target, constraintTargetLabel.value, constraintUnitLabel.value)]
  }
  if (isMilestone.value && localTask.value.constraintType === 'FNLT') {
    return [inputRules.dateOnOrBefore(target, constraintTargetLabel.value, constraintUnitLabel.value)]
  }
  return []
})

const endConstraintRules = computed(() => {
  if (isMilestone.value || !activeConstraintDate.value) return []
  const target = formatValueForDateInput(activeConstraintDate.value, inputType.value)
  if (localTask.value.constraintType === 'FNLT') {
    return [inputRules.dateOnOrBefore(target, constraintTargetLabel.value, constraintUnitLabel.value)]
  }
  return []
})

watch(
  () => [
    localTask.value.start,
    localTask.value.end,
    localTask.value.type,
    localTask.value.constraintType,
    localTask.value.constraintDate,
  ],
  async () => {
    if (!props.modelValue) return
    await nextTick()
    taskFormDialogRef.value?.validate()
  },
)
</script>

<template>
  <TaskFormDialog
    ref="taskFormDialogRef"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="dialogTitle"
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
      <v-col cols="12" class="mb-2 d-flex align-center">
        <span class="text-caption text-medium-emphasis mr-3">種別</span>
        <v-btn-toggle
          v-model="taskType"
          mandatory
          density="compact"
          color="primary"
          variant="outlined"
          divided
        >
          <v-btn value="task" size="small" prepend-icon="mdi-chart-timeline">通常タスク</v-btn>
          <v-btn value="milestone" size="small" prepend-icon="mdi-rhombus">マイルストーン</v-btn>
        </v-btn-toggle>
      </v-col>
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
        :help-text="isMilestone ? '担当者を指定できます' : '指定されたユーザーは、進捗率を変更できるようになります'"
        :users="props.users"
      />
      <v-col :cols="isMilestone ? 6 : props.enableProgress ? 4 : 6">
        <DateInput
          v-model="localTask.start"
          :type="inputType"
          :label-daily="isMilestone ? '日付' : '開始日'"
          :label-monthly="isMilestone ? '月' : '開始月'"
          :label-datetime="isMilestone ? '日時' : '開始日時'"
          :min="startConstraintMin"
          :max="startConstraintMax"
          :compare-target="isMilestone ? undefined : displayEnd"
          :compare-rule="isMilestone ? undefined : 'before'"
          :custom-rules="startConstraintRules"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col v-if="!isMilestone" :cols="props.enableProgress ? 4 : 6">
        <DateInput
          v-model="displayEnd"
          :type="inputType"
          label-daily="終了日"
          label-monthly="終了月"
          label-datetime="終了日時"
          :min="endConstraintMin"
          :max="endConstraintMax"
          :compare-target="localTask.start"
          compare-rule="after"
          :custom-rules="endConstraintRules"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col v-if="props.enableProgress && !isMilestone" cols="4">
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
      <v-col cols="12" sm="4">
        <DateInput
          v-model="displayDeadline"
          :type="inputType"
          label-daily="期限（デッドライン）"
          label-monthly="期限月（デッドライン）"
          label-datetime="期限日時（デッドライン）"
          :required="false"
          clearable
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col cols="12" :sm="localTask.constraintType ? 4 : 8">
        <v-select
          v-model="constraintTypeModel"
          :items="constraintTypeOptions"
          item-title="title"
          item-value="value"
          label="スケジュール制約"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-3"
        />
      </v-col>
      <v-col v-if="localTask.constraintType" cols="12" sm="4">
        <DateInput
          v-model="displayConstraintDate"
          :type="inputType"
          label-daily="制約日"
          label-monthly="制約月"
          label-datetime="制約日時"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col cols="12">
        <v-switch
          v-model="isLocked"
          :label="isMilestone ? 'ロック（移動・削除を禁止）' : 'ロック（移動・リサイズ・削除を禁止）'"
          density="compact"
          hide-details
          color="primary"
        ></v-switch>
      </v-col>
    </template>
  </TaskFormDialog>
</template>
