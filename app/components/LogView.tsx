import { Check } from 'lucide-react'

type Completion = {
    id: string
    userId: string
    date: string
    user: { name: string }
    task: { content: string }
}

type User = {
    id: string
    name: string
}

type DailyLogUser = User & {
    completions: Completion[]
}

interface LogViewProps {
    users: DailyLogUser[]
    date?: string
}

export function LogView({ users, date }: LogViewProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {users.map(user => (
                <div key={user.id} className="glass-card p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white shadow-md">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white">{user.name}</h3>
                            <p className="text-xs text-zinc-400">
                                {date ? `Log for ${date}` : 'Daily Log • Current Session'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {user.completions.length === 0 ? (
                            <p className="text-zinc-500 text-sm italic">No tasks completed.</p>
                        ) : (
                            user.completions.map(c => (
                                <div key={c.id} className="flex items-start gap-3 text-sm text-zinc-300">
                                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    <span className="line-through opacity-70">{c.task.content}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
