import { FirebaseFunction } from './types/index.js'
import selectGanttChart from './scripts/selectGanttChart.js'
import upsertGanttChart from './scripts/upsertGanttChart.js'
import { setupFirebaseFunction } from './scripts/common/commonFunctions.js'

const functions: FirebaseFunction = {
  selectGanttChart,
  upsertGanttChart,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}
