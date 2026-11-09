export interface TeamFormState {
  name: string
  color: string
  captainName: string
  logoUrl: string | null
  budget: string
  maxSquad: string
  minSquad: string
}

export interface ManagerOption {
  id: string
  name: string
  email: string
}
