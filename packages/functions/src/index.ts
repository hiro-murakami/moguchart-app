import { setupFirebaseFunction } from './scripts/common/commonFunctions.js'
import deleteGanttRow from './scripts/deleteGanttRow.js'
import deleteGanttTask from './scripts/deleteGanttTask.js'
import selectGanttChart from './scripts/selectGanttChart.js'
import upsertGanttRow from './scripts/upsertGanttRow.js'
import upsertGanttTask from './scripts/upsertGanttTask.js'
import updateGanttRowOrder from './scripts/updateGanttRowOrder.js'
import { FirebaseFunction } from './types/index.js'

const functions: FirebaseFunction = {
  deleteGanttRow,
  deleteGanttTask,
  selectGanttChart,
  upsertGanttRow,
  upsertGanttTask,
  updateGanttRowOrder,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}
