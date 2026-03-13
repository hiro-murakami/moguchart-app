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
import selectUsers from './scripts/selectUsers.js'
import upsertUser from './scripts/upsertUser.js'
import getGanttDataJson from './scripts/getGanttDataJson.js'
import restoreProject from './scripts/restoreProject.js'
import selectTaskComments from './scripts/selectTaskComments.js'
import upsertTaskComment from './scripts/upsertTaskComment.js'
import deleteTaskComment from './scripts/deleteTaskComment.js'
import createSnapshot from './scripts/createSnapshot.js'
import loadSnapshot from './scripts/loadSnapshot.js'
import listSnapshots from './scripts/listSnapshots.js'
import { cleanupEditEvents } from './scripts/cleanupEditEvents.js'
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
  selectUsers,
  upsertUser,
  getGanttDataJson,
  restoreProject,
  selectTaskComments,
  upsertTaskComment,
  deleteTaskComment,
  createSnapshot,
  loadSnapshot,
  listSnapshots,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}

// スケジュール関数（editEventsの自動クリーンアップ）
export { cleanupEditEvents }
