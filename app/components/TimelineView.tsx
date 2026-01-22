'use client'

import { Check, Trash2, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { toggleTaskCompletion, deleteTask } from '@/app/actions'
import { useTransition } from 'react'
import { minutesToTime, formatTimeRange, getBucketLabel, getBucketTimeRange } from '@/lib/timeUtils'

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
    daySchedule?: any
}

export function TimelineView({ tasks, currentUserId, date, daySchedule }: TimelineViewProps) {
    const [isPending, startTransition] = useTransition()

    // If we have schedule data, use it. Otherwise fall back to old logic
    const hasScheduleData = daySchedule?.success && daySchedule?.schedules

    const grouped: Record<string, any[]> = hasScheduleData
        ? daySchedule.schedules
        : {
            MORNING: [],
            AFTERNOON: [],
            EVENING: [],
            NIGHT: [],
            UNSCHEDULED: tasks
        }

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

    const renderScheduledTask = (scheduleItem: any) => {
        const task = scheduleItem.task
        const myCompletion = task.completions?.find(
            (c: any) => c.userId === currentUserId && c.date === date
        )
        const isCompletedByMe = !!myCompletion
        const otherCompletions = task.completions?.filter(
            (c: any) => c.userId !== currentUserId && c.date === date
        ) || []

        const timeDisplay = scheduleItem.startMinute !== null && scheduleItem.endMinute !== null
            ? formatTimeRange(scheduleItem.startMinute, scheduleItem.endMinute)
            : null

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
                        {timeDisplay && (
                            <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-primary/60" />
                                <span className="text-xs text-primary/80 font-medium">
                                    {timeDisplay}
                                </span>
                                {scheduleItem.source === 'AI' && scheduleItem.confidence && (
                                    <span className="text-xs text-zinc-600" title={`Confidence: ${(scheduleItem.confidence * 100).toFixed(0)}%`}>
                                        ({(scheduleItem.confidence * 100).toFixed(0)}%)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                        {otherCompletions.map((c: any) => (
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
        { key: 'MORNING', label: '🌅 Morning', timeRange: '06:00-12:00', gradient: 'from-yellow-500/20 to-orange-500/20' },
        { key: 'AFTERNOON', label: '🌤️ Afternoon', timeRange: '12:00-17:00', gradient: 'from-orange-500/20 to-red-500/20' },
        { key: 'EVENING', label: '🌆 Evening', timeRange: '17:00-21:00', gradient: 'from-purple-500/20 to-blue-500/20' },
        { key: 'NIGHT', label: '🌙 Night', timeRange: '21:00-06:00', gradient: 'from-blue-900/20 to-indigo-900/20' },
    ]

    return (
        <div className="space-y-6">
            {/* Timeline Blocks */}
            {timeBlocks.map(block => (
                <div key={block.key} className="glass-card p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className={clsx(
                                "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg",
                                block.gradient
                            )}>
                                {block.label.split(' ')[0]}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{block.label}</h3>
                                <p className="text-xs text-zinc-500">
                                    {block.timeRange} • {grouped[block.key]?.length || 0} task{grouped[block.key]?.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    {!grouped[block.key] || grouped[block.key].length === 0 ? (
                        <div className="text-center py-6 text-zinc-600 text-sm">
                            No tasks scheduled
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {grouped[block.key].map(renderScheduledTask)}
                        </div>
                    )}
                </div>
            ))}

            {/* Unscheduled Section */}
            {grouped.UNSCHEDULED && grouped.UNSCHEDULED.length > 0 && (
                <div className="glass-card p-5 rounded-2xl border-2 border-dashed border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-lg">
                            📋
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Unscheduled</h3>
                            <p className="text-xs text-zinc-500">
                                {grouped.UNSCHEDULED.length} task{grouped.UNSCHEDULED.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-0">
                        {grouped.UNSCHEDULED.map(renderScheduledTask)}
                    </div>
                </div>
            )}

            {!hasScheduleData && (
                <div className="text-center py-8 px-4 glass-card rounded-xl">
                    <p className="text-zinc-500 text-sm">
                        💡 Tasks will be automatically scheduled when you navigate to a date
                    </p>
                </div>
            )}
        </div>
    )
}
