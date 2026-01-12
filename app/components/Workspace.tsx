'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TaskItem } from './TaskItem'
import { LogView } from './LogView'
import { createTask, getHistoryDates, getDailyLog, logout, getDailyPlan, saveDailyPlan } from '@/app/actions'
import { Plus, Notebook, ListTodo, History, ArrowLeft, LogOut, CalendarPlus } from 'lucide-react'
import { clsx } from 'clsx'

type User = {
    id: string
    name: string
}

type Completion = {
    id: string
    userId: string
    date: string
    user: { name: string }
    task: { content: string }
}

type Task = {
    id: string
    content: string
    completions: Completion[]
}

type RoomData = {
    id: string
    code: string
    tasks: Task[]
    users: User[]
}

type DailyLogUser = User & {
    completions: Completion[]
}

interface WorkspaceProps {
    initialRoom: RoomData
    currentUser: User
    todayLog: DailyLogUser[]
}

export default function Workspace({ initialRoom, currentUser, todayLog }: WorkspaceProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'tasks' | 'log' | 'history' | 'plan'>('tasks')
    const [newTaskContent, setNewTaskContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // History State
    const [historyDates, setHistoryDates] = useState<string[]>([])
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null)
    const [historyLog, setHistoryLog] = useState<DailyLogUser[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [planContent, setPlanContent] = useState('')
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [savingPlan, setSavingPlan] = useState(false)

    // Polling for updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'tasks' || activeTab === 'log') {
                router.refresh()
            }
        }, 5000) // Poll every 5s
        return () => clearInterval(interval)
    }, [router, activeTab])

    // Fetch history dates when tab is opened
    useEffect(() => {
        if (activeTab === 'history' && !selectedHistoryDate) {
            getHistoryDates(initialRoom.id).then(setHistoryDates)
        }
        if (activeTab === 'plan') {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const dateStr = tomorrow.toISOString().split('T')[0]

            setLoadingPlan(true)
            getDailyPlan(currentUser.id, dateStr).then(plan => {
                setPlanContent(plan?.content || '')
                setLoadingPlan(false)
            })
        }
    }, [activeTab, initialRoom.id, selectedHistoryDate, currentUser.id])

    const handleSavePlan = async () => {
        setSavingPlan(true)
        try {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const dateStr = tomorrow.toISOString().split('T')[0]

            await saveDailyPlan(currentUser.id, dateStr, planContent)
        } catch (e) {
            console.error(e)
        } finally {
            setSavingPlan(false)
        }
    }

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTaskContent.trim() || isSubmitting) return

        setIsSubmitting(true)
        await createTask(newTaskContent, initialRoom.id)
        setNewTaskContent('')
        setIsSubmitting(false)
    }

    const loadHistoryLog = async (date: string) => {
        setLoadingHistory(true)
        setSelectedHistoryDate(date)
        try {
            const logs = await getDailyLog(initialRoom.id, date)
            setHistoryLog(logs as any)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const clearHistorySelection = () => {
        setSelectedHistoryDate(null)
        setHistoryLog([])
        // Refresh dates list
        getHistoryDates(initialRoom.id).then(setHistoryDates)
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row items-center justify-between mb-8 glass p-4 rounded-2xl gap-4">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
                        Room: {initialRoom.code}
                    </h1>
                    <p className="text-xs text-zinc-400">
                        Welcome, <span className="text-white font-medium">{currentUser.name}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => logout()}
                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Leave Room"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                    <div className="flex bg-white/5 rounded-lg p-1 overflow-x-auto max-w-full">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                                activeTab === 'tasks' ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <ListTodo className="w-4 h-4" />
                            Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('log')}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                                activeTab === 'log' ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <Notebook className="w-4 h-4" />
                            Today
                        </button>
                        <button
                            onClick={() => setActiveTab('plan')}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                                activeTab === 'plan' ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Plan
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                                activeTab === 'history' ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'tasks' && (
                    <div className="space-y-6">
                        {/* Add Task */}
                        <form onSubmit={handleAddTask} className="relative group">
                            <input
                                type="text"
                                value={newTaskContent}
                                onChange={(e) => setNewTaskContent(e.target.value)}
                                placeholder="What needs to be done?"
                                className="w-full pl-12 pr-4 py-4 rounded-2xl glass-input text-lg text-white"
                            />
                            <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                            <button
                                type="submit"
                                disabled={!newTaskContent.trim() || isSubmitting}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-primary text-white p-2 rounded-xl transition-all disabled:opacity-0"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </form>

                        {/* Task List */}
                        <div className="space-y-1">
                            {initialRoom.tasks.length === 0 ? (
                                <div className="text-center py-20 text-zinc-500">
                                    <p>No tasks yet. Add one above!</p>
                                </div>
                            ) : (
                                initialRoom.tasks.map(task => (
                                    <TaskItem
                                        key={task.id}
                                        task={task as any}
                                        currentUserId={currentUser.id}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'log' && (
                    <LogView users={todayLog} />
                )}


                {activeTab === 'history' && (
                    <div>
                        {!selectedHistoryDate ? (
                            // Date Selection View
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white mb-6">Past Logs</h2>
                                </div>
                                {historyDates.length === 0 ? (
                                    <div className="text-center py-20 text-zinc-500 glass-card rounded-2xl">
                                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No history available yet.</p>
                                        <p className="text-xs mt-2">Complete tasks to generate daily logs.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {historyDates.map(date => (
                                            <button
                                                key={date}
                                                onClick={() => loadHistoryLog(date)}
                                                className="glass-card p-6 rounded-xl hover:bg-white/10 transition-all text-left group"
                                            >
                                                <div className="text-xs text-zinc-400 mb-1">Daily Log</div>
                                                <div className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                                                    {date}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Specific Date View
                            <div>
                                <button
                                    onClick={clearHistorySelection}
                                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to History
                                </button>
                                <h2 className="text-xl font-bold text-white mb-6">Log for {selectedHistoryDate}</h2>
                                {loadingHistory ? (
                                    <div className="text-center py-20 text-zinc-500">
                                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                                        Loading...
                                    </div>
                                ) : (
                                    <LogView users={historyLog} date={selectedHistoryDate} />
                                )}
                            </div>
                        )}
                )}

                        {activeTab === 'plan' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="glass-card p-6 rounded-2xl">
                                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                        <CalendarPlus className="w-5 h-5 text-primary" />
                                        Plan for Tomorrow
                                    </h2>
                                    <p className="text-zinc-400 text-sm mb-6">
                                        What is your main focus for the next day?
                                    </p>

                                    {loadingPlan ? (
                                        <div className="text-center py-10">
                                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <textarea
                                                value={planContent}
                                                onChange={(e) => setPlanContent(e.target.value)}
                                                placeholder="I want to focus on..."
                                                className="w-full h-40 glass-input rounded-xl p-4 text-white resize-none"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handleSavePlan}
                                                    disabled={savingPlan}
                                                    className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {savingPlan ? 'Saving...' : 'Save Plan'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>
                )}
            </main>
        </div>
    )
}
