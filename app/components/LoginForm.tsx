'use client'

import { useState } from 'react'
import { login } from '../actions'
import { LogIn } from 'lucide-react'

export default function LoginForm() {
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // We only support 'login' now, room is auto-assigned
            const result = await login(name)
            if (!result.success) {
                setError(result.error || 'Access Denied')
            }
        } catch (e) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md p-8 glass-card rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-primary/30">
                    <LogIn className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Personal Log
                </h1>
                <p className="text-zinc-400 mt-2">Private Workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <input
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        required
                    />
                </div>

                {error && (
                    <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg">{error}</p>
                )}

                <button
                    type="submit"
                    className="w-full py-3 px-6 rounded-lg font-medium text-white shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-4"
                    disabled={loading}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <LogIn className="w-4 h-4 animate-spin" />
                            Entering...
                        </span>
                    ) : (
                        'Enter Workspace'
                    )}
                </button>
            </form>
        </div>
    )
}
