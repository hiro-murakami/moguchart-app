import { setupFirebaseFunction } from './scripts/common/commonFunctions.js'
import deleteGanttRow from './scripts/deleteGanttRow.js'
import deleteGanttTask from './scripts/deleteGanttTask.js'
import deleteProject from './scripts/deleteProject.js'
import selectGanttChart from './scripts/selectGanttChart.js'
import selectGanttRows from './scripts/selectGanttRows.js'
import selectProjects from './scripts/selectProjects.js'
import updateGanttRowOrder from './scripts/updateGanttRowOrder.js'
import upsertGanttRow from './scripts/upsertGanttRow.js'
import upsertGanttTasks from './scripts/upsertGanttTasks.js'
import upsertProject from './scripts/upsertProject.js'
import duplicateProject from './scripts/duplicateProject.js'
import selectUser from './scripts/selectUser.js'
import upsertUser from './scripts/upsertUser.js'
import getGanttDataJson from './scripts/getGanttDataJson.js'
import restoreProject from './scripts/restoreProject.js'
import { FirebaseFunction } from './types/index.js'

const functions: FirebaseFunction = {
  selectProjects,
  selectGanttChart,
  selectGanttRows,
  deleteProject,
  deleteGanttRow,
  deleteGanttTask,
  upsertGanttRow,
  upsertGanttTasks,
  updateGanttRowOrder,
  upsertProject,
  duplicateProject,
  selectUser,
  upsertUser,
  getGanttDataJson,
  restoreProject,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}
