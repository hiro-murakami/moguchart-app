import { defineStore } from 'pinia'
import type { User } from '@functions/types/shared'
import { selectUser, upsertUser } from '@/modules/scripts'
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/firebase'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    firebaseUser: null as FirebaseUser | null,
  }),

  getters: {
    currentUser(state): User | null {
      return state.user
    },
    isAuthenticated(state): boolean {
      return !!state.firebaseUser
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
      onAuthStateChanged(auth, async (user) => {
        this.firebaseUser = user
        if (user?.email) {
          await this.fetchUser(user.email)
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
