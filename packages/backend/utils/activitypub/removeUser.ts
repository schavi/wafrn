import { Op } from 'sequelize'
import {
  EmojiReaction,
  Follows,
  Post,
  PostMentionsUserRelation,
  QuestionPollAnswer,
  User,
  UserEmojiRelation
} from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { redisCache } from '../redis'

async function removeUser(userId: string) {
  let deleted = false
  try {
    const userToRemove = await User.findOne({ where: { remoteId: userId } })
    if (userToRemove) {
      const ownerOfDeletedPost = await User.findOne({
        where: {
          url: environment.deletedUser
        }
      })
      userToRemove.activated = false
      Post.update(
        {
          userId: ownerOfDeletedPost.id,
          content: 'Post has been deleted because remote user has been deleted'
        },
        {
          where: {
            userId: userToRemove.id
          }
        }
      )
      await Follows.destroy({
        where: {
          [Op.or]: [
            {
              followerId: userToRemove.id
            },
            {
              followedId: userToRemove.id
            }
          ]
        }
      })
      await PostMentionsUserRelation.update(
        {
          userId: ownerOfDeletedPost.id
        },
        {
          where: {
            userId: userToRemove.id
          }
        }
      )
      await EmojiReaction.destroy({
        where: {
          userId: userToRemove.id
        }
      })
      await UserEmojiRelation.destroy({
        where: {
          userId: userToRemove.id
        }
      })
      await QuestionPollAnswer.destroy({
        where: {
          userId: userToRemove.id
        }
      })
      //await userToRemove.save()
      redisCache.del('userRemoteId:' + userToRemove.remoteId.toLocaleLowerCase())
      await userToRemove.destroy()
      deleted = true
    }
  } catch (error) {
    logger.trace({
      message: 'Error deleting user',
      error: error,
      userId: userId
    })
  }
  return deleted
}

export { removeUser }
