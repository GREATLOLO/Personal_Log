'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { startOfDay, format } from 'date-fns'
import { redirect } from 'next/navigation'

// --- Auth & Room ---

export async function loginOrJoin(formData: FormData) {
    const name = formData.get('name') as string
    const roomCode = formData.get('roomCode') as string

    if (!name || !roomCode) {
        throw new Error('Name and Room Code are required')
    }

    // Find or create room
    let room = await prisma.room.findUnique({
        where: { code: roomCode },
    })

    if (!room) {
        room = await prisma.room.create({
            data: { code: roomCode },
        })
    }

    // Create user linked to room
    // Simple "Auth": We just create a new user record for this session
    // To keep it persistent, we could try to find by name, but 
    // instructions imply "login to shared space", name might be reused.
    // We will simple create a user and set a cookie.

    const user = await prisma.user.create({
        data: {
            name: name,
            roomId: room.id,
        },
    })

    const cookieStore = await cookies()
    cookieStore.set('userId', user.id)
    cookieStore.set('roomId', room.id)

    // No redirect, just revalidate path to trigger page reload state
    revalidatePath('/')
    // return { userId: user.id, roomId: room.id }
}

export async function getCurrentUser() {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) return null

    return prisma.user.findUnique({
        where: { id: userId },
        include: { room: true }
    })
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.delete('userId')
    cookieStore.delete('roomId')
    redirect('/')
}

// --- Tasks ---

export async function getRoomData(roomCode: string) {
    const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: {
            users: true,
            tasks: {
                include: {
                    completions: true
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    })
    return room
}

export async function createTask(content: string, roomId: string) {
    await prisma.task.create({
        data: {
            content,
            roomId,
        }
    })
    revalidatePath(`/room/[roomCode]`) // Note: dynamic path revalidation limitation
}

export async function deleteTask(taskId: string) {
    await prisma.task.delete({
        where: { id: taskId }
    })
    // Revalidation would happen by client trigger usually or blanket revalidate
}

export async function toggleTaskCompletion(taskId: string, userId: string, isCompleted: boolean) {
    const today = format(new Date(), 'yyyy-MM-dd')

    if (isCompleted) {
        // Upsert completion
        // But since we have a unique constraint, we can just create if not exists
        // Using upsert to be safe
        await prisma.completion.upsert({
            where: {
                userId_taskId_date: {
                    userId,
                    taskId,
                    date: today
                }
            },
            update: {},
            create: {
                userId,
                taskId,
                date: today
            }
        })
    } else {
        // Remove completion
        await prisma.completion.deleteMany({
            where: {
                userId,
                taskId,
                date: today
            }
        })
    }

    // No need to return, client optimizes or re-fetches
}

// --- Daily Log ---

export async function getDailyLog(roomId: string, dateStr?: string) {
    const date = dateStr || format(new Date(), 'yyyy-MM-dd')

    // Get all users in the room
    const users = await prisma.user.findMany({
        where: { roomId },
        include: {
            completions: {
                where: { date },
                include: {
                    task: true
                }
            }
        }
    })

    return users
}

export async function getHistoryDates(roomId: string) {
    // Find all completions for this room
    // distinct on date
    const completions = await prisma.completion.findMany({
        where: {
            task: {
                roomId: roomId
            }
        },
        select: {
            date: true
        },
        distinct: ['date'],
        orderBy: {
            date: 'desc'
        }
    })

    const today = format(new Date(), 'yyyy-MM-dd')
    return completions
        .map((c: { date: string }) => c.date)
        .filter((date: string) => date !== today)
}

// --- Daily Plan ---

export async function getDailyPlan(userId: string, date: string) {
    return prisma.dailyPlan.findUnique({
        where: {
            userId_date: {
                userId,
                date
            }
        }
    })
}

export async function saveDailyPlan(userId: string, date: string, content: string) {
    await prisma.dailyPlan.upsert({
        where: {
            userId_date: {
                userId,
                date
            }
        },
        update: { content },
        create: {
            userId,
            date,
            content
        }
    })
    revalidatePath('/')
}
