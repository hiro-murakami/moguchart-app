import type { DeleteTaskComment } from '../types/shared'
import deleteComment from './deleteComment'

const deleteTaskComment: DeleteTaskComment = async (id) => {
  return deleteComment(id)
}

export default deleteTaskComment

