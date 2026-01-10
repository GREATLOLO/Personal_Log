'use client'

import { useActionState } from 'react'
import { loginOrJoin } from '@/app/actions'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            disabled={pending}
            type="submit"
            className={clsx(
                "w-full py-3 px-6 rounded-lg font-medium text-white shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]",
                "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500",
                "disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            )}
        >
            {pending ? (
                <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                </span>
            ) : (
                "Enter Space"
            )}
        </button>
    )
}

export default function LoginForm() {
    return (
        <div className="w-full max-w-md p-8 glass-card rounded-2xl animate-in fade-in zoom-in duration-500 relative z-10">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-4 flex items-center justify-center backdrop-blur-md shadow-inner">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    Shared Space
                </h1>
                <p className="text-zinc-400 mt-2 text-sm">Synchronize your tasks & progress</p>
            </div>

            <form action={loginOrJoin} className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-zinc-300 ml-1">
                        Display Name
                    </label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Alice"
                        className="w-full px-4 py-3 rounded-xl glass-input text-white focus:ring-2 focus:ring-violet-500/50 outline-none placeholder:text-zinc-600"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="roomCode" className="text-sm font-medium text-zinc-300 ml-1">
                        Room Code
                    </label>
                    <input
                        id="roomCode"
                        name="roomCode"
                        type="text"
                        required
                        placeholder="e.g. TEAM-A"
                        className="w-full px-4 py-3 rounded-xl glass-input text-white focus:ring-2 focus:ring-violet-500/50 outline-none uppercase tracking-wide placeholder:text-zinc-600"
                    />
                </div>

                <div className="pt-2">
                    <SubmitButton />
                </div>
            </form>
        </div>
    )
}
