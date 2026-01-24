import { setupFirebaseFunction } from './scripts/common/commonFunctions.js'
import selectGanttChart from './scripts/selectGanttChart.js'
import upsertGanttTask from './scripts/upsertGanttTask.js'
import { FirebaseFunction } from './types/index.js'

const functions: FirebaseFunction = {
  selectGanttChart,
  upsertGanttTask,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}
