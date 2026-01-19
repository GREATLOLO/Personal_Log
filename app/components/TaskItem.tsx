'use client'

import { Check, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toggleTaskCompletion, deleteTask } from '@/app/actions'
import { useOptimistic, useTransition } from 'react'

// Define types locally or import from Prisma if possible, but for Client Components 
// it's often safer to define the shape we expect from props.
type Completion = {
    id: string
    userId: string
    date: string
    user: { name: string }
}

type TaskWithCompletions = {
    id: string
    content: string
    completions: Completion[]
}

interface TaskItemProps {
    task: TaskWithCompletions
    currentUserId: string
    onDelete?: (id: string) => void
    date: string
}

export function TaskItem({ task, currentUserId, date }: TaskItemProps) {
    const [isPending, startTransition] = useTransition()

    // Use the passed date (effective today) instead of system date
    const today = date

    const myCompletion = task.completions.find(
        c => c.userId === currentUserId && c.date === today
    )

    const isCompletedByMe = !!myCompletion

    // Optimistic UI could be handled at parent, but local toggle is also fine for immediate feedback
    // if we don't mind a flicker on reval if it's slow. 
    // Ideally useOptimistic at parent level. 
    // For this "Rapid" implementation, we'll rely on fast server actions + router.refresh() 
    // but add a local loading state.

    const handleToggle = () => {
        startTransition(async () => {
            // Optimistically we could toggle visually here if we had local state
            // but without useOptimistic, we just wait for server.
            // To make it feel premiums, let's just trigger action.
            // The parent polling will eventually catch up, but the action revalidates path.

            await toggleTaskCompletion(task.id, currentUserId, !isCompletedByMe)
        })
    }

    const handleDelete = () => {
        if (confirm('Delete this task?')) {
            startTransition(async () => {
                await deleteTask(task.id)
            })
        }
    }

    // Other users who completed this TODAY
    const otherCompletions = task.completions.filter(
        c => c.userId !== currentUserId && c.date === today
    )

    return (
        <div className={clsx(
            "group flex items-center justify-between p-4 mb-3 rounded-xl glass hover:bg-white/10 transition-all duration-300",
            (isCompletedByMe || isPending) && "bg-white/5 border-primary/30"
        )}>
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={handleToggle}
                    disabled={isPending}
                    className={clsx(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                        isCompletedByMe
                            ? "bg-primary border-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                            : "border-zinc-500 group-hover:border-primary/50",
                        isPending && "opacity-50 cursor-wait"
                    )}
                >
                    {isCompletedByMe && <Check className="w-4 h-4 text-white" />}
                </button>

                <span className={clsx(
                    "text-lg font-medium transition-all duration-300",
                    isCompletedByMe ? "text-zinc-500 line-through" : "text-zinc-100"
                )}>
                    {task.content}
                </span>
            </div>

            <div className="flex items-center gap-3">
                {/* Avatars of others who finished it */}
                <div className="flex -space-x-2">
                    {otherCompletions.map(c => (
                        <div
                            key={c.id}
                            title={`Completed by ${c.user.name}`}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0a0a0a] shadow-lg cursor-help transition-transform hover:scale-110 hover:z-10"
                        >
                            {c.user.name.charAt(0).toUpperCase()}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleDelete}
                    className="p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:rotate-12"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}
