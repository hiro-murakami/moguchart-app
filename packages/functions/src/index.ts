import { setupFirebaseFunction } from './scripts/common/commonFunctions.js'
import deleteGanttRow from './scripts/deleteGanttRow.js'
import deleteGanttTask from './scripts/deleteGanttTask.js'
import selectGanttChart from './scripts/selectGanttChart.js'
import selectProjects from './scripts/selectProjects.js'
import updateGanttRowOrder from './scripts/updateGanttRowOrder.js'
import upsertGanttRow from './scripts/upsertGanttRow.js'
import upsertGanttTask from './scripts/upsertGanttTask.js'
import upsertProject from './scripts/upsertProject.js'
import { FirebaseFunction } from './types/index.js'

const functions: FirebaseFunction = {
  selectProjects,
  selectGanttChart,
  deleteGanttRow,
  deleteGanttTask,
  upsertGanttRow,
  upsertGanttTask,
  updateGanttRowOrder,
  upsertProject,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}
