import { defineStore } from 'pinia'
import { VERSION, type User, type TutorialKey } from '@functions/types/shared'
import { selectUser, upsertUser } from '@/modules/scripts'
import {
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/firebase'
import { toDateTimeString } from '@/modules/utils'

/**
 * ユーザーの識別子を取得する。
 * Googleログインユーザーはemail、匿名ユーザーはuidを返す。
 */
const getUserIdentifier = (firebaseUser: FirebaseUser): string => {
  return firebaseUser.email || firebaseUser.uid
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    firebaseUser: null as FirebaseUser | null,
    /** バージョンが更新されたかどうか（初回ログイン時はfalse） */
    versionUpdated: false,
    /** プロジェクト一覧ダイアログの自動表示を抑制するフラグ（匿名ログイン後の案内ダイアログ表示中に使用） */
    suppressProjectList: false,
  }),

  getters: {
    currentUser(state): User | null {
      return state.user
    },
    isAuthenticated(state): boolean {
      return !!state.firebaseUser
    },
    /** 匿名ログイン中かどうか */
    isAnonymous(state): boolean {
      return !!state.firebaseUser?.isAnonymous
    },
    currentTheme(state): 'light' | 'dark' | 'system' | undefined {
      return state.user?.attribute.theme
    },
  },

  actions: {
    async fetchUser(identifier: string) {
      if (!identifier) return
      this.user = await selectUser(identifier)
    },

    async saveUser(user: User) {
      await upsertUser(user)
      this.user = user
    },

    async completeTutorial(key: TutorialKey) {
      if (!this.user) return

      if (!this.user.attribute) this.user.attribute = {} as any
      if (!this.user.attribute.tutorialCompleted) this.user.attribute.tutorialCompleted = {}

      if (!this.user.attribute.tutorialCompleted[key]) {
        this.user.attribute.tutorialCompleted[key] = true
        await this.saveUser(this.user)
      }
    },

    async signIn() {
      const provider = new GoogleAuthProvider()
      try {
        await signInWithPopup(auth, provider)
      } catch (error) {
        console.error('Sign in error:', error)
      }
    },

    /** 匿名ログイン */
    async signInAnonymously() {
      try {
        await signInAnonymously(auth)
      } catch (error) {
        console.error('Anonymous sign in error:', error)
      }
    },

    async signOut() {
      try {
        await firebaseSignOut(auth)
        this.clear()
      } catch (error) {
        console.error('Sign out error:', error)
      }
    },

    initializeAuthListener() {
      onAuthStateChanged(auth, async (firebaseUser) => {
        this.firebaseUser = firebaseUser
        if (firebaseUser) {
          const identifier = getUserIdentifier(firebaseUser)
          await this.fetchUser(identifier)

          if (this.user) {
            const previousVersion = this.user.attribute?.appVersion
            // 新規ユーザーでなく、前回バージョンが現在と異なる場合はリリースノートを表示
            this.versionUpdated = !!previousVersion && previousVersion !== VERSION
            this.user.attribute = {
              ...this.user.attribute,
              lastLoginAt: toDateTimeString(),
              photoURL: firebaseUser.photoURL,
              appVersion: VERSION,
            }
          } else {
            this.user = {
              email: identifier,
              displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'ゲスト' : ''),
              attribute: {
                lastLoginAt: toDateTimeString(),
                photoURL: firebaseUser.photoURL,
                appVersion: VERSION,
              },
            }
          }
          if (this.user) {
            await this.saveUser(this.user)
          }
        } else {
          this.clear()
        }
      })
    },

    clear() {
      this.user = null
      this.firebaseUser = null
    },

    setSuppressProjectList(value: boolean) {
      this.suppressProjectList = value
    },
  },
})
