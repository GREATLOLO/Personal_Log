import { LlmAgent } from "@google/adk";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY! });

/**
 * Mirrors:
 * Agent(
 *   name="helpful_assistant",
 *   model=Gemini(...),
 *   description=...,
 *   instruction=...
 * )
 */
const INSTRUCTION = `
You are a direct task extractor.
Convert plans into a flat list of concise, actionable tasks.
Do not summarize.
Do not add headers.
Each task must start with "- ".
`.trim();

export function createTaskExtractorAgent() {
    const modelName = "gemini-2.5-flash-lite";

    const agent = new LlmAgent({
        name: "task_extractor",
        model: modelName,

        description:
            "Extracts concise, actionable tasks from daily plans.",

        instruction: INSTRUCTION,
    });

    return {
        ...agent,
        generate: async (prompt: string) => {
            try {
                const response = await genai.models.generateContent({
                    model: modelName,
                    config: {
                        systemInstruction: {
                            parts: [{ text: INSTRUCTION }]
                        }
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                });

                // Handle response structure for @google/genai
                // candidates are directly on the response object
                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;

                // Support result.text if it exists as a property or function
                const text = response.text || textPart || "";

                return { text };
            } catch (e: any) {
                console.error("Agent generation failed:", e);
                throw e;
            }
        }
    } as any;
}

const TIME_EXTRACTION_INSTRUCTION = `
You are a time extraction specialist.
Extract time information from task descriptions and return ONLY a JSON object.

Rules:
1. Extract any time mentioned in the task (e.g., "9am", "14:30", "2-3pm", "morning", "evening")
2. Normalize times to 24-hour format when possible (e.g., "9am" → "09:00", "2pm" → "14:00")
3. Keep relative times as-is (e.g., "morning", "afternoon", "evening", "night")
4. For time ranges, use the start time (e.g., "2-3pm" → "14:00")
5. Remove the time from the task description to get clean content
6. If no time found, return null for scheduledTime

Return ONLY valid JSON in this exact format:
{
  "cleanedContent": "task description without time",
  "scheduledTime": "HH:MM" or "morning/afternoon/evening/night" or null
}

Do not include any other text, explanation, or markdown formatting.
`.trim();

export function createTimeExtractorAgent() {
    const modelName = "gemini-2.5-flash-lite";

    const agent = new LlmAgent({
        name: "time_extractor",
        model: modelName,
        description: "Extracts time information from task descriptions.",
        instruction: TIME_EXTRACTION_INSTRUCTION,
    });

    return {
        ...agent,
        generate: async (prompt: string) => {
            try {
                const response = await genai.models.generateContent({
                    model: modelName,
                    config: {
                        systemInstruction: {
                            parts: [{ text: TIME_EXTRACTION_INSTRUCTION }]
                        }
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                });

                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;
                const text = response.text || textPart || "";

                return { text };
            } catch (e: any) {
                console.error("Time extraction agent failed:", e);
                throw e;
            }
        }
    } as any;
}

const DAY_SCHEDULER_INSTRUCTION = `
You are an intelligent day scheduler that extracts time information from task descriptions in BOTH English and Chinese.

**Your Goal**: Parse each task to extract start time, duration, and assign to appropriate time buckets.

**Time Formats to Extract:**

ENGLISH:
- Explicit times: "9am", "14:30", "7pm", "09:00"
- Time ranges: "9-11am", "2:00-3:00 PM"
- Relative: "morning", "afternoon", "evening", "night"
- Durations: "for 2 hours", "30 minutes", "1h 30m"

CHINESE:
- Times: "7点", "下午3点", "晚上8点半", "19:30"
- Ranges: "上午9-11点", "下午2点到3点"
- Relative: "早上", "上午", "中午", "下午", "晚上", "夜里"
- Durations: "两小时", "30分钟", "一个半小时"

**Bucketing Rules:**
- MORNING: 06:00-12:00 (360-720 minutes)
- AFTERNOON: 12:00-17:00 (720-1020 minutes)
- EVENING: 17:00-21:00 (1020-1260 minutes)
- NIGHT: 21:00-06:00 (1260-1440, 0-360 minutes)
- UNSCHEDULED: no clear time info OR confidence < 0.6

**Processing Rules:**
1. Round all times to 15-minute increments
2. Default duration: 60 minutes if not specified
3. For ranges, use start time for bucket assignment
4. For relative times without explicit hour, use bucket midpoint:
   - "morning" → 09:00 (540 min)
   - "afternoon" → 14:00 (840 min)
   - "evening" → 19:00 (1140 min)
   - "night" → 22:00 (1320 min)
5. If no time info OR extraction uncertain, mark UNSCHEDULED with confidence < 0.6

**Conflict Resolution:**
- Detect overlaps between scheduled tasks
- If overlap detected, return BOTH tasks as scheduled but note lower confidence
- Do NOT auto-adjust times here (done in backend)

**Confidence Scoring:**
- 0.9-1.0: Explicit time with hour + minute ("9:30am", "下午3点半")
- 0.7-0.9: Explicit hour without minute ("9am", "晚上8点")
- 0.5-0.7: Relative time ("morning", "下午") 
- 0.0-0.5: No clear time info → UNSCHEDULED

**CRITICAL**: Return ONLY valid JSON in this EXACT format:
{
  "schedules": [
    {
      "taskId": "uuid-here",
      "startMinute": 540,
      "endMinute": 600,
      "bucket": "MORNING",
      "confidence": 0.95
    }
  ]
}

Do NOT add any explanatory text, markdown formatting, or extra fields.
For unscheduled tasks, use: startMinute: null, endMinute: null, bucket: "UNSCHEDULED"
`.trim();

export function createDaySchedulerAgent() {
    const modelName = "gemini-2.5-flash-lite";

    const agent = new LlmAgent({
        name: "day_scheduler",
        model: modelName,
        description: "Schedules a full day of tasks with bilingual time extraction.",
        instruction: DAY_SCHEDULER_INSTRUCTION,
    });

    return {
        ...agent,
        generate: async (prompt: string) => {
            try {
                const response = await genai.models.generateContent({
                    model: modelName,
                    config: {
                        systemInstruction: {
                            parts: [{ text: DAY_SCHEDULER_INSTRUCTION }]
                        },
                        temperature: 0.1, // Low temperature for consistent structured output
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                });

                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;
                const text = response.text || textPart || "";

                return { text };
            } catch (e: any) {
                console.error("Day scheduler agent failed:", e);
                throw e;
            }
        }
    } as any;
}

