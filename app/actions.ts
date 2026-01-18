'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { startOfDay, format } from 'date-fns'
import { redirect } from 'next/navigation'

// --- Auth & Room ---

// --- Date Helpers ---

export async function getEffectiveToday() {
    const cookieStore = await cookies()
    const offset = parseInt(cookieStore.get('dateOffset')?.value || '0')
    const date = new Date()
    if (offset) {
        date.setDate(date.getDate() + offset)
    }
    return format(date, 'yyyy-MM-dd')
}

export async function advanceDay() {
    const cookieStore = await cookies()
    const currentOffset = parseInt(cookieStore.get('dateOffset')?.value || '0')
    cookieStore.set('dateOffset', (currentOffset + 1).toString())
    revalidatePath('/')
}

export async function resetDateOffset() {
    const cookieStore = await cookies()
    cookieStore.delete('dateOffset')
    revalidatePath('/')
}

// --- Auth & Room ---

function verifyCredentials(name: string): boolean {
    const normalized = name.trim().toLowerCase()
    return normalized === 'keqing' || normalized === 'winter'
}

export async function login(name: string) {
    // 1. Strict Auth Check
    if (!verifyCredentials(name)) {
        return { success: false, error: 'Access Denied: Restricted to Keqing and Winter' }
    }

    // 2. Auto-Assign Room based on Name
    // Keqing -> Room "KEQING", Winter -> Room "WINTER"
    const normalizedName = name.trim() // Keep display casing
    const roomCode = normalizedName.toUpperCase()

    // 3. Ensure Room Exists
    let room = await prisma.room.findUnique({
        where: { code: roomCode },
    })

    if (!room) {
        room = await prisma.room.create({
            data: { code: roomCode },
        })
    }

    // 4. Ensure User Exists in that Room
    let user = await prisma.user.findFirst({
        where: { name: normalizedName, roomId: room.id }
    })

    if (!user) {
        user = await prisma.user.create({
            data: { name: normalizedName, roomId: room.id }
        })
    }

    // 5. Set Session
    const cookieStore = await cookies()
    cookieStore.set('userId', user.id)
    cookieStore.set('roomId', room.id)
    return { success: true }
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
    const today = await getEffectiveToday()

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
    const date = dateStr || await getEffectiveToday()

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

    const today = await getEffectiveToday()
    return completions
        .map((c: { date: string }) => c.date)
        .filter((date: string) => date !== today)
}

export async function getAllHistory(roomId: string) {
    // Fetch all completions for the room, ordered by date
    const users = await prisma.user.findMany({
        where: { roomId },
        include: {
            completions: {
                include: {
                    task: true
                },
                orderBy: {
                    date: 'desc'
                }
            }
        }
    })

    // Group completions by date
    const historyByDate: Record<string, any[]> = {}
    users.forEach(user => {
        user.completions.forEach(c => {
            if (!historyByDate[c.date]) historyByDate[c.date] = []
            historyByDate[c.date].push({
                userName: user.name,
                content: c.task.content
            })
        })
    })

    return historyByDate
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
// --- Google Docs Sync ---
import { google } from 'googleapis'

export async function syncToGoogleDocs(users: any[], date?: string) {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/documents']
    })

    const docs = google.docs({ version: 'v1', auth })
    const documentId = process.env.GOOGLE_DOC_ID
    const adkName = process.env.GOOGLE_ADK_NAME || 'Default ADK'

    if (!documentId) throw new Error('GOOGLE_DOC_ID not set')

    const dateHeader = date ? `Daily Log for ${date}` : "Daily Log (Current Session)"
    const logBody = users.map(user => {
        const tasks = user.completions.map((c: any) => `- ${c.task.content}`).join('\n')
        return `### ${user.name}\n${tasks || '*No tasks completed*'}`
    }).join('\n\n')

    const separator = '='.repeat(40)
    const content = `\n\n# ${dateHeader}\n**Sync Source: ${adkName}**\n\n${logBody}\n\n${separator}\n`

    await docs.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [
                {
                    insertText: {
                        endOfSegmentLocation: {},
                        text: content,
                    },
                },
            ],
        },
    })
}

// --- Test Actions ---

export async function deleteHistory(userId: string, roomId: string) {
    // Delete completions for this user in this room
    await prisma.completion.deleteMany({
        where: {
            userId,
            task: {
                roomId
            }
        }
    })

    // Delete plans for this user
    await prisma.dailyPlan.deleteMany({
        where: {
            userId
        }
    })

    revalidatePath('/')
}

// --- Vercel AI SDK & AI Gateway integration ---
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function refinePlanWithAI(content: string) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
        return { success: false, error: 'Gemini API Key missing (GOOGLE_GENAI_API_KEY)' }
    }

    // Configure the Google provider to use Vercel AI Gateway
    const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: 'https://ai-gateway.vercel.sh/v3/ai',
    })

    try {
        const { text } = await generateText({
            model: google('gemini-1.5-flash'),
            prompt: `
            Analyze the following daily plan and provide a structured response.
            1. A concise summary of the plan (max 2 sentences).
            2. A list of specific, actionable bullet points for the next day.

            Format the response clearly with "SUMMARY:" and "TASKS:" headers.

            PLAN CONTENT:
            ${content}
            `,
        })

        if (!text) throw new Error('Failed to generate plan refinement')

        // Simple parsing of the response
        const summaryMatch = text.match(/SUMMARY:([\s\S]*?)(?=TASKS:|$)/i)
        const tasksMatch = text.match(/TASKS:([\s\S]*)/i)

        const summary = summaryMatch ? summaryMatch[1].trim() : ""
        const tasks = tasksMatch ? tasksMatch[1].trim() : ""

        return {
            success: true,
            content: text.trim(),
            summary,
            tasks
        }
    } catch (error) {
        console.error('AI Refinement failed:', error)
        return { success: false, error: 'AI Refinement failed. Make sure to npm install ai @ai-sdk/google' }
    }
}
