import type { UpsertTaskComment } from '../types/shared'
import upsertComment from './upsertComment'

const upsertTaskComment: UpsertTaskComment = async (comment, email) => {
  return upsertComment(comment, email)
}

export default upsertTaskComment

