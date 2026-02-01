export interface FirebaseFunction {
  [index: string]: Function
}

export type Authority = {
  owners?: string[]
  editors?: string[]
  viewers?: string[]
}
