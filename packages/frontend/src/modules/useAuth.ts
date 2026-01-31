import { ref } from 'vue'
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/firebase'

const provider = new GoogleAuthProvider()

const user = ref<User | null>(null)

export const useAuth = () => {
  const signIn = async () => {
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error(error)
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error(error)
    }
  }

  onAuthStateChanged(auth, (account) => {
    user.value = account
  })

  return {
    user,
    signIn,
    signOut,
  }
}
