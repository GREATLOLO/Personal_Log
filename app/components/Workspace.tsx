'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TaskItem } from './TaskItem'
import { LogView } from './LogView'
import { TimelineView } from './TimelineView'
import {
    createTask,
    getHistoryDates,
    getDailyLog,
    logout,
    getDailyPlan,
    saveDailyPlan,
    advanceDay,
    deleteHistory,
    getEffectiveToday,
    resetDateOffset,
    getAllHistory,
    refinePlanWithAI,
    extractTimeFromTask,
    scheduleDayTasks,
    getDaySchedule
} from '@/app/actions'
import { Plus, Notebook, ListTodo, History, ArrowLeft, LogOut, CalendarPlus, Target, Trash2, RefreshCw, Sparkles, ListChecks, Check, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { format, addDays, parseISO } from 'date-fns'

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
    scheduledTime?: string | null
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
    const [activeTab, setActiveTab] = useState<'tasks' | 'log' | 'timeline' | 'history' | 'plan'>('tasks')
    const [newTaskContent, setNewTaskContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Schedule State
    const [daySchedule, setDaySchedule] = useState<any>(null)
    const [loadingSchedule, setLoadingSchedule] = useState(false)

    // History State
    const [historyDates, setHistoryDates] = useState<string[]>([])
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null)
    const [historyLog, setHistoryLog] = useState<DailyLogUser[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [planContent, setPlanContent] = useState('')
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [savingPlan, setSavingPlan] = useState(false)
    const [todayTarget, setTodayTarget] = useState<string | null>(null)
    const [currentDate, setCurrentDate] = useState<string>('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)

    // Polling for updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'tasks' || activeTab === 'log') {
                router.refresh()
            }
        }, 5000) // Poll every 5s
        return () => clearInterval(interval)
    }, [router, activeTab])

    // Initial date fetch
    useEffect(() => {
        getEffectiveToday().then(setCurrentDate)
    }, [])

    // Auto-schedule day when date changes
    useEffect(() => {
        if (currentDate && initialRoom.id) {
            const scheduleDayIfNeeded = async () => {
                setLoadingSchedule(true)
                try {
                    // Try to schedule (will be a no-op if already scheduled)
                    await scheduleDayTasks(initialRoom.id, currentDate)

                    // Fetch the schedule
                    const scheduleResult = await getDaySchedule(initialRoom.id, currentDate)
                    if (scheduleResult.success) {
                        setDaySchedule(scheduleResult)
                    }
                } catch (error) {
                    console.error('Failed to load schedule:', error)
                } finally {
                    setLoadingSchedule(false)
                }
            }
            scheduleDayIfNeeded()
        }
    }, [currentDate, initialRoom.id])

    // Refresh today's target when date or completions change
    useEffect(() => {
        if (currentDate) {
            getDailyPlan(currentUser.id, currentDate).then(plan => {
                setTodayTarget(plan?.content || null)
            })
        }
    }, [currentDate, currentUser.id, todayLog])

    // Fetch history dates when tab is opened
    useEffect(() => {
        if (activeTab === 'history' && !selectedHistoryDate) {
            getHistoryDates(initialRoom.id).then(setHistoryDates)
        }
        if (activeTab === 'plan' && currentDate) {
            const tomDate = addDays(parseISO(currentDate), 1)
            const dateStr = format(tomDate, 'yyyy-MM-dd')

            setLoadingPlan(true)
            getDailyPlan(currentUser.id, dateStr).then(plan => {
                setPlanContent(plan?.content || '')
                setLoadingPlan(false)
            })
        }
    }, [activeTab, initialRoom.id, selectedHistoryDate, currentUser.id, currentDate])

    const [aiSummary, setAiSummary] = useState('')
    const [aiTasks, setAiTasks] = useState('')

    const handleSavePlan = async () => {
        if (!currentDate) return
        setSavingPlan(true)
        try {
            const tomDate = addDays(parseISO(currentDate), 1)
            const dateStr = format(tomDate, 'yyyy-MM-dd')

            await saveDailyPlan(currentUser.id, dateStr, planContent)
        } catch (e) {
            console.error(e)
        } finally {
            setSavingPlan(false)
        }
    }

    const handleRefinePlan = async () => {
        if (!planContent.trim()) return
        setLoadingPlan(true)
        setAiSummary('')
        setAiTasks('')
        try {
            const result = await refinePlanWithAI(planContent)
            if (result.success) {
                if (result.summary) setAiSummary(result.summary)
                if (result.tasks) setAiTasks(result.tasks)
                // Also update the main content if needed, but the user wants summary + bullet points
                // We'll keep the refined content in planContent as well for saving
                if (result.content) setPlanContent(result.content)
            } else {
                alert(result.error || 'Failed to refine plan')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingPlan(false)
        }
    }

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTaskContent.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            // Extract time from task content using AI
            const extraction = await extractTimeFromTask(newTaskContent)

            // Create task with extracted time
            await createTask(
                extraction.cleanedContent || newTaskContent,
                initialRoom.id,
                extraction.scheduledTime
            )

            setNewTaskContent('')
        } catch (error) {
            console.error('Failed to create task:', error)
        } finally {
            setIsSubmitting(false)
        }
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

    const handleAdvanceDay = async () => {
        setIsAdvancing(true)
        await advanceDay()
        const newDate = await getEffectiveToday()
        setCurrentDate(newDate)
        setIsAdvancing(false)
    }

    const handleDeleteHistory = async () => {
        if (confirm('Are you sure you want to delete ALL your history and plans? This cannot be undone.')) {
            setIsDeleting(true)
            await deleteHistory(currentUser.id, initialRoom.id)
            router.refresh()
            setIsDeleting(false)
        }
    }

    const handleResetDate = async () => {
        await resetDateOffset()
        const newDate = await getEffectiveToday()
        setCurrentDate(newDate)
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
                            <CalendarPlus className="w-4 h-4" />
                            Next Day Plan
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
                            onClick={() => setActiveTab('timeline')}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                                activeTab === 'timeline' ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <Clock className="w-4 h-4" />
                            Timeline
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
            <main className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                {activeTab === 'tasks' && (
                    <div className="max-w-2xl mx-auto space-y-6">
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

                                    {aiSummary && (
                                        <div className="glass-card p-4 rounded-xl border border-primary/20 bg-primary/5">
                                            <h3 className="text-sm font-bold text-primary mb-1 uppercase tracking-wider flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />
                                                AI Summary
                                            </h3>
                                            <p className="text-zinc-200 text-sm italic leading-relaxed">
                                                "{aiSummary}"
                                            </p>
                                        </div>
                                    )}

                                    {aiTasks && (
                                        <div className="glass-card p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                                            <h3 className="text-sm font-bold text-violet-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                                <ListChecks className="w-4 h-4" />
                                                Action Items
                                            </h3>
                                            <div className="text-zinc-300 text-sm whitespace-pre-line leading-relaxed">
                                                {aiTasks}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between gap-4">
                                        <button
                                            onClick={handleRefinePlan}
                                            disabled={loadingPlan || !planContent.trim()}
                                            className="px-6 py-2 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2 border border-violet-500/30"
                                        >
                                            <RefreshCw className={clsx("w-4 h-4", loadingPlan && "animate-spin")} />
                                            Refine & Plan
                                        </button>
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
                )}

                {activeTab === 'log' && (
                    <div className="max-w-2xl mx-auto space-y-8">
                        {/* Current Checklist */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                Today's Target
                            </h2>

                            <form onSubmit={handleAddTask} className="mb-8 group">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={newTaskContent}
                                        onChange={(e) => setNewTaskContent(e.target.value)}
                                        placeholder="Add a new goal for today..."
                                        className="flex-1 glass-input rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:ring-2 focus:ring-primary/50 transition-all"
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !newTaskContent.trim()}
                                        className="p-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] active:scale-95"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-2">
                                {initialRoom.tasks.filter(t => !t.completions.some(c => c.userId === currentUser.id && c.date === currentDate)).length === 0 && initialRoom.tasks.length > 0 ? (
                                    <div className="text-center py-10 text-emerald-400/60 font-medium">
                                        <Check className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Everything complete for now!</p>
                                    </div>
                                ) : initialRoom.tasks.length === 0 ? (
                                    <div className="text-center py-10 text-zinc-500">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                            <ListTodo className="w-8 h-8 opacity-20" />
                                        </div>
                                        <p>No active targets. Add one above!</p>
                                    </div>
                                ) : (
                                    initialRoom.tasks.map(task => (
                                        <TaskItem
                                            key={task.id}
                                            task={task as any}
                                            currentUserId={currentUser.id}
                                            date={currentDate}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                )}


                {activeTab === 'timeline' && (
                    <div className="max-w-3xl mx-auto">
                        {loadingSchedule ? (
                            <div className="text-center py-12 text-zinc-500">
                                <div className="animate-spin mb-4 mx-auto w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                                Scheduling tasks...
                            </div>
                        ) : (
                            <TimelineView
                                tasks={initialRoom.tasks as any}
                                currentUserId={currentUser.id}
                                date={currentDate}
                                daySchedule={daySchedule}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        {!selectedHistoryDate ? (
                            // Date Selection View
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white">Past Logs</h2>
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
                                    <LogView users={historyLog} date={selectedHistoryDate} roomId={initialRoom.id} />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Removed separate plan tab as it's merged into the first tab */}
            </main>

            {/* Test Utilities - Bottom of Workspace */}
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-4 text-xs opacity-40 hover:opacity-100 transition-opacity">
                <p className="w-full text-center text-zinc-500 mb-2 font-medium">Test Utilities (Temporary)</p>
                <button
                    onClick={handleAdvanceDay}
                    disabled={isAdvancing}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-violet-500/20 text-zinc-400 hover:text-violet-400 border border-transparent hover:border-violet-500/30 transition-all"
                >
                    <RefreshCw className={clsx("w-3 h-3", isAdvancing && "animate-spin")} />
                    Reach Next Day
                </button>
                <button
                    onClick={handleResetDate}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30 transition-all"
                >
                    Reset Date
                </button>
                <button
                    onClick={handleDeleteHistory}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all"
                >
                    <Trash2 className="w-3 h-3" />
                    Delete History
                </button>
                <p className="w-full text-center text-zinc-600 mt-2">
                    Current Simulation Date: <span className="text-zinc-400 font-mono">{currentDate || 'Loading...'}</span>
                </p>
            </div>
        </div>
    )
}
