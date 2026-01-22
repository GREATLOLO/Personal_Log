// Time utility functions for scheduling

export type ScheduleBucket = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'UNSCHEDULED'

export interface TimeRange {
    startMinute: number
    endMinute: number
}

/**
 * Convert minutes from midnight to HH:MM format
 * @param minutes 0-1439
 * @returns "09:00", "14:30", etc.
 */
export function minutesToTime(minutes: number): string {
    if (minutes < 0 || minutes >= 1440) {
        throw new Error(`Invalid minutes: ${minutes}. Must be 0-1439.`)
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Convert HH:MM time string to minutes from midnight
 * @param time "09:00", "14:30", etc.
 * @returns 0-1439
 */
export function timeToMinutes(time: string): number {
    const [hoursStr, minsStr] = time.split(':')
    const hours = parseInt(hoursStr, 10)
    const mins = parseInt(minsStr, 10)

    if (isNaN(hours) || isNaN(mins) || hours < 0 || hours >= 24 || mins < 0 || mins >= 60) {
        throw new Error(`Invalid time format: ${time}`)
    }

    return hours * 60 + mins
}

/**
 * Determine which bucket a start time falls into
 * MORNING: 06:00-12:00 (360-720)
 * AFTERNOON: 12:00-17:00 (720-1020)
 * EVENING: 17:00-21:00 (1020-1260)
 * NIGHT: 21:00-06:00 (1260-1440, 0-360)
 */
export function getBucket(startMinute: number | null): ScheduleBucket {
    if (startMinute === null) return 'UNSCHEDULED'

    if (startMinute >= 360 && startMinute < 720) return 'MORNING'
    if (startMinute >= 720 && startMinute < 1020) return 'AFTERNOON'
    if (startMinute >= 1020 && startMinute < 1260) return 'EVENING'
    return 'NIGHT' // 1260-1440 or 0-360
}

/**
 * Format time range as "09:00-10:00"
 */
export function formatTimeRange(startMinute: number | null, endMinute: number | null): string {
    if (startMinute === null || endMinute === null) return ''
    return `${minutesToTime(startMinute)}-${minutesToTime(endMinute)}`
}

/**
 * Round minutes to nearest 15-minute increment
 */
export function roundToQuarterHour(minutes: number): number {
    return Math.round(minutes / 15) * 15
}

/**
 * Detect if two time ranges overlap
 */
export function hasOverlap(
    range1: TimeRange,
    range2: TimeRange
): boolean {
    return (range1.startMinute < range2.endMinute && range1.endMinute > range2.startMinute)
}

/**
 * Find all conflicts in a list of time ranges
 * Returns array of conflicting pairs
 */
export function findConflicts(
    ranges: (TimeRange & { id: string })[]
): Array<[string, string]> {
    const conflicts: Array<[string, string]> = []

    for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
            if (hasOverlap(ranges[i], ranges[j])) {
                conflicts.push([ranges[i].id, ranges[j].id])
            }
        }
    }

    return conflicts
}

/**
 * Adjust overlapping schedules by shifting lower-confidence tasks
 * Returns adjusted schedules
 */
export function resolveConflicts<T extends TimeRange & { id: string; confidence: number }>(
    schedules: T[]
): T[] {
    const sorted = [...schedules].sort((a, b) => a.startMinute - b.startMinute)
    const adjusted: T[] = []

    for (const schedule of sorted) {
        let current = { ...schedule }
        let hasConflict = true
        let attempts = 0

        while (hasConflict && attempts < 10) {
            hasConflict = false

            for (const existing of adjusted) {
                if (hasOverlap(current, existing)) {
                    // If current has lower confidence, shift it
                    if (current.confidence < existing.confidence) {
                        const duration = current.endMinute - current.startMinute
                        current.startMinute = existing.endMinute
                        current.endMinute = current.startMinute + duration

                        // Ensure we don't go past midnight
                        if (current.endMinute >= 1440) {
                            current.endMinute = 1439
                        }
                    }
                    hasConflict = true
                    break
                }
            }

            attempts++
        }

        adjusted.push(current)
    }

    return adjusted
}

/**
 * Get bucket label for display
 */
export function getBucketLabel(bucket: ScheduleBucket): string {
    const labels: Record<ScheduleBucket, string> = {
        MORNING: '🌅 Morning',
        AFTERNOON: '🌤️ Afternoon',
        EVENING: '🌆 Evening',
        NIGHT: '🌙 Night',
        UNSCHEDULED: '📋 Unscheduled'
    }
    return labels[bucket]
}

/**
 * Get bucket time range description
 */
export function getBucketTimeRange(bucket: ScheduleBucket): string {
    const ranges: Record<ScheduleBucket, string> = {
        MORNING: '06:00-12:00',
        AFTERNOON: '12:00-17:00',
        EVENING: '17:00-21:00',
        NIGHT: '21:00-06:00',
        UNSCHEDULED: 'No time set'
    }
    return ranges[bucket]
}
