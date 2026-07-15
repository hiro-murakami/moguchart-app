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
import downloadProjectZip from './scripts/downloadProjectZip.js'
import restoreProject from './scripts/restoreProject.js'
import selectTaskComments from './scripts/selectTaskComments.js'
import upsertTaskComment from './scripts/upsertTaskComment.js'
import deleteTaskComment from './scripts/deleteTaskComment.js'
import selectComments from './scripts/selectComments.js'
import upsertComment from './scripts/upsertComment.js'
import deleteComment from './scripts/deleteComment.js'
import createSnapshot from './scripts/createSnapshot.js'
import loadSnapshot from './scripts/loadSnapshot.js'
import listSnapshots from './scripts/listSnapshots.js'
import getSnapshotDownloadUrl from './scripts/getSnapshotDownloadUrl.js'
import deleteSnapshot from './scripts/deleteSnapshot.js'
import { cleanupEditEvents } from './scripts/cleanupEditEvents.js'
import { cleanupAnonymousData } from './scripts/cleanupAnonymousData.js'
import { cleanupPresence } from './scripts/cleanupPresence.js'
import { cleanupRateLimits } from './scripts/cleanupRateLimits.js'
import { FirebaseFunction } from './types/index.js'

// REST API（外部アプリ向け）
import { api } from './api/index.js'

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
  downloadProjectZip,
  restoreProject,
  selectTaskComments,
  upsertTaskComment,
  deleteTaskComment,
  selectComments,
  upsertComment,
  deleteComment,
  createSnapshot,
  loadSnapshot,
  listSnapshots,
  getSnapshotDownloadUrl,
  deleteSnapshot,
}

export const gantt = {
  functions: setupFirebaseFunction(functions),
}

// REST API（外部アプリ向け）
export { api }

// スケジュール関数（自動クリーンアップ）
export { cleanupEditEvents, cleanupAnonymousData, cleanupPresence, cleanupRateLimits }
