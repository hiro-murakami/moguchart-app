import { defineStore } from 'pinia'
import { VERSION, type User, type TutorialKey } from '@functions/types/shared'
import { selectUser, upsertUser } from '@/modules/scripts'
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/firebase'
import { toDateTimeString } from '@/modules/utils'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    firebaseUser: null as FirebaseUser | null,
    /** バージョンが更新されたかどうか（初回ログイン時はfalse） */
    versionUpdated: false,
  }),

  getters: {
    currentUser(state): User | null {
      return state.user
    },
    isAuthenticated(state): boolean {
      return !!state.firebaseUser
    },
    currentTheme(state): 'light' | 'dark' | 'system' | undefined {
      return state.user?.attribute.theme
    },
  },

  actions: {
    async fetchUser(email: string) {
      if (!email) return
      this.user = await selectUser(email)
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
        if (firebaseUser?.email) {
          await this.fetchUser(firebaseUser.email)

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
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || '',
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
  },
})
