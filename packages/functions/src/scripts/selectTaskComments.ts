import type { SelectTaskComments } from '../types/shared'
import selectComments from './selectComments'

const selectTaskComments: SelectTaskComments = async (taskId, email) => {
  return selectComments({ taskId }, email)
}

export default selectTaskComments

