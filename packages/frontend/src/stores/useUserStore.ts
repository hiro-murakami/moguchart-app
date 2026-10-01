import { defineStore } from 'pinia'
import { VERSION, type User, type TutorialKey } from '@functions/types/shared'
import { selectUser, upsertUser, selectCollaborators } from '@/modules/scripts'
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


export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    firebaseUser: null as FirebaseUser | null,
    /** 過去に関わったコラボレーター（補完候補用） */
    collaborators: [] as User[],
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
          // まず uid で検索
          await this.fetchUser(firebaseUser.uid)

          // uid で見つからず、email がある場合は既存ユーザー移行のため email でも検索
          if (!this.user && firebaseUser.email) {
            await this.fetchUser(firebaseUser.email)
          }

          if (this.user) {
            const previousVersion = this.user.attribute?.appVersion
            // 新規ユーザーでなく、前回バージョンが現在と異なる場合はリリースノートを表示
            this.versionUpdated = !!previousVersion && previousVersion !== VERSION
            // 過去に入り込んだ非メールアドレス文字列（UIDなど）をクリーンアップ
            const cleanHistory = (this.user.attribute?.authorityInputHistory ?? []).filter(
              (val) => typeof val === 'string' && val.includes('@'),
            )
            this.user = {
              ...this.user,
              id: firebaseUser.uid,
              email: firebaseUser.email || this.user.email || undefined,
              // 既存の displayName が設定されている場合は保持し、未設定の場合のみ初期値を設定
              displayName:
                this.user.displayName || firebaseUser.displayName || (firebaseUser.isAnonymous ? 'ゲスト' : ''),
              attribute: {
                ...this.user.attribute,
                authorityInputHistory: cleanHistory,
                lastLoginAt: toDateTimeString(),
                photoURL: firebaseUser.photoURL,
                appVersion: VERSION,
              },
            }
          } else {
            this.user = {
              id: firebaseUser.uid,
              email: firebaseUser.email || undefined,
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
          // コラボレーター一覧を自動取得
          await this.fetchCollaborators()
        } else {
          this.clear()
        }
      })
    },

    /** 過去に関わったコラボレーター一覧を取得（過去の入力履歴もフォールバック統合） */
    async fetchCollaborators() {
      if (!this.firebaseUser) return
      try {
        const fetched = await selectCollaborators()
        const userMap = new Map<string, User>()

        const myEmail = this.firebaseUser.email?.toLowerCase().trim()
        const myUid = this.firebaseUser.uid

        // 1. バックエンドから取得した本物のコラボレーター
        for (const u of fetched || []) {
          const lowerEmail = u.email?.toLowerCase().trim()
          if (u.id === myUid || (lowerEmail && lowerEmail === myEmail)) {
            continue
          }
          const key = u.email || u.id
          if (key) {
            userMap.set(key, u)
          }
        }

        // 2. 過去の authorityInputHistory にあるメールアドレスのフォールバック
        const history = this.user?.attribute?.authorityInputHistory ?? []
        for (const item of history) {
          if (typeof item === 'string' && item.includes('@')) {
            const lowerItem = item.toLowerCase().trim()
            if (lowerItem === myEmail || item === myUid) {
              continue
            }
            if (!userMap.has(item) && !userMap.has(lowerItem)) {
              userMap.set(item, {
                id: item,
                email: item,
                attribute: {},
              })
            }
          }
        }

        this.collaborators = Array.from(userMap.values())
      } catch (e) {
        console.warn('[useUserStore] Failed to fetch collaborators:', e)
      }
    },

    clear() {
      this.user = null
      this.firebaseUser = null
      this.collaborators = []
    },

    setSuppressProjectList(value: boolean) {
      this.suppressProjectList = value
    },
  },
})

