import { Check, Copy, Share2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { syncToGoogleDocs } from '@/app/actions'
import { clsx } from 'clsx'

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
    const [copied, setCopied] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

    const handleCopy = () => {
        const text = users.map(user => {
            const tasks = user.completions.map(c => `- ${c.task.content}`).join('\n');
            return `## ${user.name}\n${tasks || '*No tasks completed*'}`;
        }).join('\n\n');

        const header = date ? `Daily Log for ${date}` : "Daily Log (Current Session)";
        navigator.clipboard.writeText(`# ${header}\n\n${text}`);

        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSync = async () => {
        setSyncing(true)
        setSyncStatus('idle')
        try {
            await syncToGoogleDocs(users, date)
            setSyncStatus('success')
            setTimeout(() => setSyncStatus('idle'), 3000)
        } catch (error) {
            console.error('Sync failed:', error)
            setSyncStatus('error')
            setTimeout(() => setSyncStatus('idle'), 3000)
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-3">
                {date && (
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-xl transition-all border text-sm font-medium shadow-sm",
                            syncStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                syncStatus === 'error' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                    "bg-white/5 hover:bg-primary/20 text-zinc-300 hover:text-white border-white/10 hover:border-primary/30"
                        )}
                    >
                        {syncing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Syncing...
                            </>
                        ) : syncStatus === 'success' ? (
                            <>
                                <Check className="w-4 h-4" />
                                Synced to Google Docs
                            </>
                        ) : syncStatus === 'error' ? (
                            "Sync Failed"
                        ) : (
                            <>
                                <Share2 className="w-4 h-4" />
                                Sync to Google Docs
                            </>
                        )}
                    </button>
                )}

                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-primary/20 text-zinc-300 hover:text-white rounded-xl transition-all border border-white/10 text-sm font-medium shadow-sm hover:border-primary/30"
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4" />
                            Copy for Google Docs
                        </>
                    )}
                </button>
            </div>

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
        </div>
    )
}
