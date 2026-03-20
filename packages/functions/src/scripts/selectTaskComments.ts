import type { SelectTaskComments } from '../types/shared'
import selectComments from './selectComments'

const selectTaskComments: SelectTaskComments = async (taskId) => {
  return selectComments({ taskId })
}

export default selectTaskComments

