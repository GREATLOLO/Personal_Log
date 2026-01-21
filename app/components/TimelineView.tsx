'use client'

import { Check, Trash2, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { toggleTaskCompletion, deleteTask } from '@/app/actions'
import { useTransition } from 'react'

type Completion = {
    id: string
    userId: string
    date: string
    user: { name: string }
}

type TaskWithCompletions = {
    id: string
    content: string
    scheduledTime?: string | null
    completions: Completion[]
}

interface TimelineViewProps {
    tasks: TaskWithCompletions[]
    currentUserId: string
    date: string
}

// Helper function to categorize time
function categorizeTime(scheduledTime: string | null | undefined): string {
    if (!scheduledTime) return 'unscheduled'

    const lower = scheduledTime.toLowerCase()

    // Check for relative times
    if (lower.includes('morning') || lower.includes('am')) return 'morning'
    if (lower.includes('afternoon')) return 'afternoon'
    if (lower.includes('evening')) return 'evening'
    if (lower.includes('night')) return 'night'

    // Parse HH:MM format
    const match = scheduledTime.match(/(\d{1,2}):?(\d{2})?/)
    if (match) {
        const hour = parseInt(match[1])
        if (hour >= 5 && hour < 12) return 'morning'
        if (hour >= 12 && hour < 17) return 'afternoon'
        if (hour >= 17 && hour < 21) return 'evening'
        if (hour >= 21 || hour < 5) return 'night'
    }

    return 'unscheduled'
}

// Format time for display
function formatTime(scheduledTime: string | null | undefined): string {
    if (!scheduledTime) return ''

    // If already a relative time, capitalize it
    const lower = scheduledTime.toLowerCase()
    if (['morning', 'afternoon', 'evening', 'night'].includes(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1)
    }

    return scheduledTime
}

export function TimelineView({ tasks, currentUserId, date }: TimelineViewProps) {
    const [isPending, startTransition] = useTransition()

    // Group tasks by time category
    const grouped: Record<string, TaskWithCompletions[]> = {
        morning: [],
        afternoon: [],
        evening: [],
        night: [],
        unscheduled: []
    }

    tasks.forEach(task => {
        const category = categorizeTime(task.scheduledTime)
        grouped[category].push(task)
    })

    // Sort tasks within each group by time
    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
            if (!a.scheduledTime) return 1
            if (!b.scheduledTime) return -1
            return a.scheduledTime.localeCompare(b.scheduledTime)
        })
    })

    const handleToggle = (taskId: string, isCompleted: boolean) => {
        startTransition(async () => {
            await toggleTaskCompletion(taskId, currentUserId, !isCompleted)
        })
    }

    const handleDelete = (taskId: string) => {
        if (confirm('Delete this task?')) {
            startTransition(async () => {
                await deleteTask(taskId)
            })
        }
    }

    const renderTask = (task: TaskWithCompletions) => {
        const myCompletion = task.completions.find(
            c => c.userId === currentUserId && c.date === date
        )
        const isCompletedByMe = !!myCompletion
        const otherCompletions = task.completions.filter(
            c => c.userId !== currentUserId && c.date === date
        )

        return (
            <div
                key={task.id}
                className={clsx(
                    "group flex items-center justify-between p-3 mb-2 rounded-lg glass hover:bg-white/10 transition-all duration-300",
                    isCompletedByMe && "bg-white/5 border-primary/30"
                )}
            >
                <div className="flex items-center gap-3 flex-1">
                    <button
                        onClick={() => handleToggle(task.id, isCompletedByMe)}
                        disabled={isPending}
                        className={clsx(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0",
                            isCompletedByMe
                                ? "bg-primary border-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                                : "border-zinc-500 group-hover:border-primary/50",
                            isPending && "opacity-50 cursor-wait"
                        )}
                    >
                        {isCompletedByMe && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                        <span className={clsx(
                            "text-sm font-medium transition-all duration-300 block truncate",
                            isCompletedByMe ? "text-zinc-500 line-through" : "text-zinc-100"
                        )}>
                            {task.content}
                        </span>
                        {task.scheduledTime && (
                            <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-primary/60" />
                                <span className="text-xs text-primary/80 font-medium">
                                    {formatTime(task.scheduledTime)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                        {otherCompletions.map(c => (
                            <div
                                key={c.id}
                                title={`Completed by ${c.user.name}`}
                                className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0a0a0a] shadow-lg cursor-help transition-transform hover:scale-110 hover:z-10"
                            >
                                {c.user.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:rotate-12"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    const timeBlocks = [
        { key: 'morning', label: '🌅 Morning', icon: '☀️', gradient: 'from-yellow-500/20 to-orange-500/20' },
        { key: 'afternoon', label: '🌤️ Afternoon', icon: '🌞', gradient: 'from-orange-500/20 to-red-500/20' },
        { key: 'evening', label: '🌆 Evening', icon: '🌙', gradient: 'from-purple-500/20 to-blue-500/20' },
        { key: 'night', label: '🌙 Night', icon: '✨', gradient: 'from-blue-900/20 to-indigo-900/20' },
    ]

    return (
        <div className="space-y-6">
            {/* Timeline Blocks */}
            {timeBlocks.map(block => (
                <div key={block.key} className="glass-card p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <div className={clsx(
                            "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg",
                            block.gradient
                        )}>
                            {block.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{block.label}</h3>
                            <p className="text-xs text-zinc-500">
                                {grouped[block.key].length} task{grouped[block.key].length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {grouped[block.key].length === 0 ? (
                        <div className="text-center py-6 text-zinc-600 text-sm">
                            No tasks scheduled
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {grouped[block.key].map(renderTask)}
                        </div>
                    )}
                </div>
            ))}

            {/* Unscheduled Section */}
            {grouped.unscheduled.length > 0 && (
                <div className="glass-card p-5 rounded-2xl border-2 border-dashed border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-lg">
                            📋
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Unscheduled</h3>
                            <p className="text-xs text-zinc-500">
                                {grouped.unscheduled.length} task{grouped.unscheduled.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-0">
                        {grouped.unscheduled.map(renderTask)}
                    </div>
                </div>
            )}
        </div>
    )
}
