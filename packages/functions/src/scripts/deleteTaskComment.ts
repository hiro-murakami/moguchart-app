import type { DeleteTaskComment } from '../types/shared'
import deleteComment from './deleteComment'

const deleteTaskComment: DeleteTaskComment = async (id, email) => {
  return deleteComment(id, email)
}

export default deleteTaskComment

