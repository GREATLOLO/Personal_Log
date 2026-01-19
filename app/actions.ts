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
    const userId = cookieStore.get('userId')?.value
    const roomId = cookieStore.get('roomId')?.value

    const nextOffset = currentOffset + 1
    cookieStore.set('dateOffset', nextOffset.toString())

    // Convert next day's plan to tasks logic (if user and room exist)
    if (userId && roomId) {
        // Calculate new date
        const date = new Date()
        date.setDate(date.getDate() + nextOffset)
        const dateStr = format(date, 'yyyy-MM-dd')

        // Fetch plan
        const plan = await prisma.dailyPlan.findUnique({
            where: { userId_date: { userId, date: dateStr } }
        })

        if (plan && plan.content) {
            // Delete existing tasks for clean slate (as per "replace" request)
            await prisma.task.deleteMany({
                where: { roomId }
            })

            // Parse bullets (lines starting with - or *)
            const tasks = plan.content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('-') || line.startsWith('*'))
                .map(line => line.substring(1).trim())
                .filter(Boolean)

            // Create new tasks
            if (tasks.length > 0) {
                await prisma.task.createMany({
                    data: tasks.map(content => ({
                        content,
                        roomId
                    }))
                })
            }
        }
    }

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

    // 4. Ensure 1-to-1 User-Room mapping
    // Remove any OTHER users from this room to ensure clean state
    await prisma.user.deleteMany({
        where: {
            roomId: room.id,
            name: { not: normalizedName }
        }
    })

    // Find or create the user
    let user = await prisma.user.findFirst({
        where: { roomId: room.id }
    })

    if (!user) {
        user = await prisma.user.create({
            data: { name: normalizedName, roomId: room.id }
        })
    } else if (user.name !== normalizedName) {
        // Should have been deleted above, but safety check: update name
        user = await prisma.user.update({
            where: { id: user.id },
            data: { name: normalizedName }
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
// import { createGoogleGenerativeAI } from '@ai-sdk/google'
// import { generateText } from 'ai'
import { LlmAgent } from "@google/adk";

const GEMINI_MODEL = "gemini-2.5-flash";

export async function refinePlanWithAI(content: string) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
        return { success: false, error: 'Gemini API Key missing (GOOGLE_GENAI_API_KEY)' }
    }

    // Configure the Google provider with ADK
    const agent = new LlmAgent({
        model: GEMINI_MODEL,
        apiKey: apiKey
    });

    try {
        const prompt = `
            You are a direct task extractor.
            Convert the following daily plan into a flat list of concise, actionable tasks.
            Do not provide a summary.
            Do not provide headers like "TASKS:".
            Just list the tasks, one per line, starting with a dash "- ".

            PLAN CONTENT:
            ${content}
            `;

        const response = await agent.generate(prompt);
        const text = response.text || response.content || ""; // Handling potential response structures

        if (!text) throw new Error('Failed to generate plan refinement')

        // Direct parsing: just split by newline and filter
        const summary = "Plan converted to tasks."
        const tasks = text.trim()

        return {
            success: true,
            content: text.trim(),
            summary,
            tasks
        }
    } catch (error: any) {
        console.error('AI Refinement failed:', error)
        // Return the REAL error message for debugging
        return { success: false, error: `AI Error: ${error.message || error}` }
    }
}
