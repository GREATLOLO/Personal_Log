import LoginForm from './components/LoginForm'
import Workspace from './components/Workspace'
import { getCurrentUser, getRoomData, getDailyLog } from './actions'

export default async function Home() {
  const user = await getCurrentUser()
  let room = null
  let todayLog = []

  if (user && user.room) {
    room = await getRoomData(user.room.code)
    if (room) {
      todayLog = await getDailyLog(room.id) as any
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px] animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[100px] animate-pulse duration-[7000ms]" />
      </div>

      {room && user ? (
        <div className="w-full h-full pt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <Workspace
            initialRoom={room as any}
            currentUser={user}
            todayLog={todayLog}
          />
        </div>
      ) : (
        <LoginForm />
      )}

      {!room && (
        <footer className="absolute bottom-8 text-zinc-500 text-xs text-center z-10">
          <p>Premium Task Synchronization</p>
        </footer>
      )}
    </main>
  )
}
