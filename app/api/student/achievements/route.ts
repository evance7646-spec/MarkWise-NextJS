import { NextResponse, type NextRequest } from 'next/server';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';
import { computeAndCachePoints } from '@/lib/gamificationEngine';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── Points formula ────────────────────────────────────────────────────────────
const PTS = {
  attend: 10,
  ontime: 3,
  earlyBird: 2,
  weekly_100: 25,
  monthly_100: 100,
  streak_7: 50,
  streak_30: 200,
  unit_90: 30,
  comeback: 20,
  first: 10,
  groupLeader: 15,
};

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES = [
  { id: 'first_attend', name: 'First Step', emoji: '🎯' },
  { id: 'streak_7', name: '7-Day Streak', emoji: '🔥' },
  { id: 'streak_14', name: '14-Day Streak', emoji: '🌟' },
  { id: 'streak_30', name: 'Month Warrior', emoji: '🏆' },
  { id: 'perfect_week', name: 'Perfect Week', emoji: '⭐' },
  { id: 'perfect_month', name: 'Perfect Month', emoji: '💎' },
  { id: 'above_90', name: 'Top Attender', emoji: '📈' },
  { id: 'comeback', name: 'Comeback Kid', emoji: '💪' },
  { id: 'early_bird_5', name: 'Early Bird', emoji: '🌅' },
  { id: 'group_leader_3', name: 'Group Pioneer', emoji: '🦊' },
];

function earnedBadgeIds(
  stats: { firstSessionDone: boolean; longestStreak: number; perfectWeeks: number; perfectMonths: number; unitsAbove90: string[]; comebacks: number },
  earlyBirdCount: number,
  groupLeaderCount: number,
): string[] {
  const ids: string[] = [];
  if (stats.firstSessionDone) ids.push('first_attend');
  if (stats.longestStreak >= 7) ids.push('streak_7');
  if (stats.longestStreak >= 14) ids.push('streak_14');
  if (stats.longestStreak >= 30) ids.push('streak_30');
  if (stats.perfectWeeks >= 1) ids.push('perfect_week');
  if (stats.perfectMonths >= 1) ids.push('perfect_month');
  if (stats.unitsAbove90.length >= 1) ids.push('above_90');
  if (stats.comebacks >= 1) ids.push('comeback');
  if (earlyBirdCount >= 5) ids.push('early_bird_5');
  if (groupLeaderCount >= 3) ids.push('group_leader_3');
  return ids;
}

// ── Daily challenges pool ─────────────────────────────────────────────────────
const CHALLENGE_POOL = [
  { id: 'earlybird', title: 'Early Bird', description: 'Be in the first 10% to attend a session', icon: 'sunny', points: 15 },
  { id: 'perfect_day', title: 'Perfect Day', description: 'Attend every scheduled class today', icon: 'star', points: 20 },
  { id: 'ontime_all', title: 'Punctual', description: 'Mark attendance on-time in every session today', icon: 'time', points: 10 },
  { id: 'leader', title: 'Group Pioneer', description: 'Be first in your group to check in', icon: 'trophy', points: 30 },
  { id: 'unit_check', title: 'Show Up', description: 'Attend at least one session today', icon: 'school', points: 5 },
];

/** Return 3 challenges for today, deterministically seeded by day-of-year */
function getDailyChallenges(completedIds: Set<string>): Array<{
  id: string; title: string; description: string; icon: string; points: number; completed: boolean;
}> {
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  const seed = dayOfYear % CHALLENGE_POOL.length;
  const indices = [seed, (seed + 1) % CHALLENGE_POOL.length, (seed + 2) % CHALLENGE_POOL.length];
  return indices.map((i) => ({
    ...CHALLENGE_POOL[i],
    completed: completedIds.has(CHALLENGE_POOL[i].id),
  }));
}

// ── Week boundary helpers ─────────────────────────────────────────────────────
function startOfWeek(d = new Date()): Date {
  const dt = new Date(d);
  const day = dt.getDay() || 7; // Mon=1 … Sun=7
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function startOfDay(d = new Date()): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  let studentId: string;
  try {
    const payload = verifyStudentAccessToken(token);
    studentId = payload.studentId;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    // ── 1. Core gamification stats (cached, ≤ 1h stale) ──────────────────
    const gamResult = await computeAndCachePoints(studentId);
    const { stats, points: enginePoints } = gamResult;

    // ── 2. earlyBirdCount (OfflineAttendanceRecord, raw SQL) ──────────────
    //    A session qualifies if the student's position (by scannedAt) ≤ 10% of total
    const earlyBirdRows = await prisma.$queryRaw<[{ count: bigint }]>`
      WITH my_scans AS (
        SELECT "unitCode", "lectureRoom", "sessionStart", "scannedAt"
        FROM "OfflineAttendanceRecord"
        WHERE "studentId" = ${studentId}
      ),
      session_stats AS (
        SELECT
          m."unitCode", m."lectureRoom", m."sessionStart",
          COUNT(a."id") as total,
          COUNT(a."id") FILTER (WHERE a."scannedAt" < m."scannedAt") as before_me
        FROM my_scans m
        JOIN "OfflineAttendanceRecord" a
          ON a."unitCode" = m."unitCode"
          AND a."lectureRoom" = m."lectureRoom"
          AND a."sessionStart" = m."sessionStart"
        GROUP BY m."unitCode", m."lectureRoom", m."sessionStart", m."scannedAt"
      )
      SELECT COUNT(*)::int as count
      FROM session_stats
      WHERE (before_me + 1)::float / NULLIF(total, 0) <= 0.1
    `;
    const earlyBirdCount = Number(earlyBirdRows[0]?.count ?? 0);

    // ── 3. groupLeaderCount (first in group to check in) ─────────────────
    const groupLeaderRows = await prisma.$queryRaw<[{ count: bigint }]>`
      WITH my_scans AS (
        SELECT "unitCode", "lectureRoom", "sessionStart", "scannedAt"
        FROM "OfflineAttendanceRecord"
        WHERE "studentId" = ${studentId}
      ),
      my_group_mates AS (
        SELECT DISTINCT gm2."studentId"
        FROM "GroupMember" gm
        JOIN "GroupMember" gm2
          ON gm2."groupId" = gm."groupId"
          AND gm2."studentId" != ${studentId}
        WHERE gm."studentId" = ${studentId}
          AND gm."leftAt" IS NULL
          AND gm2."leftAt" IS NULL
      )
      SELECT COUNT(*)::int as count
      FROM my_scans m
      WHERE NOT EXISTS (
        SELECT 1
        FROM "OfflineAttendanceRecord" other
        JOIN my_group_mates mgm ON mgm."studentId" = other."studentId"
        WHERE other."unitCode" = m."unitCode"
          AND other."lectureRoom" = m."lectureRoom"
          AND other."sessionStart" = m."sessionStart"
          AND other."scannedAt" < m."scannedAt"
      )
    `;
    const groupLeaderCount = Number(groupLeaderRows[0]?.count ?? 0);

    // ── 4. Augmented total points (includes earlyBird + groupLeader bonuses) ──
    const augmentedTotal =
      enginePoints.total +
      earlyBirdCount * PTS.earlyBird +
      groupLeaderCount * PTS.groupLeader;

    // ── 5. Rank + totalStudents within same course ────────────────────────
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { courseId: true, institutionId: true, points: { select: { statsJson: true } } },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404, headers: corsHeaders });

    // Refresh this student's cached points with augmented total
    await prisma.studentPoints.upsert({
      where: { studentId },
      create: {
        studentId,
        courseId: student.courseId,
        institutionId: student.institutionId,
        totalPoints: augmentedTotal,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        attendancePct: stats.percent,
      },
      update: {
        totalPoints: augmentedTotal,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        attendancePct: stats.percent,
        computedAt: new Date(),
      },
    });

    const allCoursePoints = await prisma.studentPoints.findMany({
      where: { courseId: student.courseId },
      orderBy: { totalPoints: 'desc' },
      select: { studentId: true, totalPoints: true, currentStreak: true, student: { select: { name: true } } },
    });

    const totalStudents = allCoursePoints.length;
    const rank = allCoursePoints.findIndex((p) => p.studentId === studentId) + 1;

    // Rank trend: how many positions improved vs last visit (stored in statsJson)
    const prevStatsJson = (student.points?.statsJson as any) ?? {};
    const previousRank: number = prevStatsJson.previousRank ?? rank;
    const rankTrend = previousRank - rank; // positive = moved up

    // ── 6. Leaderboard (top 10) ───────────────────────────────────────────
    const leaderboard = allCoursePoints.slice(0, 10).map((p, i) => {
      const r = i + 1;
      const streak = p.currentStreak ?? 0;
      let trend: string;
      if (r === 1) trend = 'champion';
      else if (streak >= 7) trend = 'up';
      else if (streak === 0) trend = 'down';
      else trend = 'stable';
      return {
        id: p.studentId,
        name: p.student?.name ?? 'Unknown',
        points: p.totalPoints,
        streak,
        rank: r,
        trend,
        avatar: (p.student?.name ?? '?')[0].toUpperCase(),
      };
    });

    // ── 7. newlyUnlockedBadge ─────────────────────────────────────────────
    const currentEarnedIds = earnedBadgeIds(stats, earlyBirdCount, groupLeaderCount);

    const cachedPoints = await prisma.studentPoints.findUnique({
      where: { studentId },
      select: { statsJson: true },
    });
    const prevEarnedIds: string[] =
      (cachedPoints?.statsJson as any)?.earnedBadgeIds ?? [];

    const newBadgeIds = currentEarnedIds.filter((id) => !prevEarnedIds.includes(id));
    const newlyUnlockedBadge =
      newBadgeIds.length > 0
        ? (BADGES.find((b) => b.id === newBadgeIds[newBadgeIds.length - 1]) ?? null)
        : null;

    // Always persist earnedBadgeIds + current rank so next call can diff both
    await prisma.studentPoints.update({
      where: { studentId },
      data: {
        statsJson: {
          ...(cachedPoints?.statsJson as object ?? {}),
          earnedBadgeIds: currentEarnedIds,
          previousRank: rank,
        },
      },
    });

    // ── 8. Daily challenges ───────────────────────────────────────────────
    //    "completed" = student actually did the thing today
    const todayStart = startOfDay();
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);

    const todayScans = await prisma.offlineAttendanceRecord.findMany({
      where: { studentId, scannedAt: { gte: todayStart, lt: todayEnd } },
      select: { unitCode: true, lectureRoom: true, sessionStart: true, scannedAt: true },
    });
    const attendedToday = todayScans.length > 0;

    // "earlybird" challenge completed if any today scan qualifies early-bird
    let earlybirdToday = false;
    if (todayScans.length > 0) {
      const todayEarlyRows = await prisma.$queryRaw<[{ count: bigint }]>`
        WITH my_today AS (
          SELECT "unitCode", "lectureRoom", "sessionStart", "scannedAt"
          FROM "OfflineAttendanceRecord"
          WHERE "studentId" = ${studentId}
            AND "scannedAt" >= ${todayStart}
            AND "scannedAt" < ${todayEnd}
        ),
        session_stats AS (
          SELECT
            m."unitCode", m."lectureRoom", m."sessionStart",
            COUNT(a."id") as total,
            COUNT(a."id") FILTER (WHERE a."scannedAt" < m."scannedAt") as before_me
          FROM my_today m
          JOIN "OfflineAttendanceRecord" a
            ON a."unitCode" = m."unitCode"
            AND a."lectureRoom" = m."lectureRoom"
            AND a."sessionStart" = m."sessionStart"
          GROUP BY m."unitCode", m."lectureRoom", m."sessionStart", m."scannedAt"
        )
        SELECT COUNT(*)::int as count FROM session_stats
        WHERE (before_me + 1)::float / NULLIF(total, 0) <= 0.1
      `;
      earlybirdToday = Number(todayEarlyRows[0]?.count ?? 0) > 0;
    }

    // Check today's OnlineAttendanceRecord for on-time
    const ONTIME_MS = 5 * 60 * 1000;
    const todayOnlineScans = await prisma.onlineAttendanceRecord.findMany({
      where: { studentId, markedAt: { gte: todayStart, lt: todayEnd } },
      include: { session: { select: { createdAt: true } } },
    });
    const allOntimeToday =
      todayOnlineScans.length > 0 &&
      todayOnlineScans.every((r) => {
        const diff = r.markedAt.getTime() - r.session.createdAt.getTime();
        return diff >= 0 && diff <= ONTIME_MS;
      });

    // Points earned today
    const todayOntimeCount = todayOnlineScans.filter((r) => {
      const diff = r.markedAt.getTime() - r.session.createdAt.getTime();
      return diff >= 0 && diff <= ONTIME_MS;
    }).length;
    const pointsToday =
      todayScans.length * PTS.attend +
      todayOnlineScans.length * PTS.attend +
      todayOntimeCount * PTS.ontime +
      (earlybirdToday ? PTS.earlyBird : 0);

    const completedChallengeIds = new Set<string>();
    if (attendedToday) completedChallengeIds.add('unit_check');
    if (earlybirdToday) completedChallengeIds.add('earlybird');
    if (allOntimeToday) completedChallengeIds.add('ontime_all');

    const dailyChallenges = getDailyChallenges(completedChallengeIds);

    // ── 9. Weekly quests ──────────────────────────────────────────────────
    const weekStart = startOfWeek();
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

    const weekScans = await prisma.offlineAttendanceRecord.findMany({
      where: { studentId, scannedAt: { gte: weekStart, lt: weekEnd } },
      select: { unitCode: true, lectureRoom: true, sessionStart: true, scannedAt: true },
    });

    // Days this week that have any attendance
    const weekDaysAttended = new Set(
      weekScans.map((s) => s.scannedAt.toISOString().slice(0, 10)),
    ).size;

    // On-time count this week (from OnlineAttendanceRecord)
    const weekOnlineScans = await prisma.onlineAttendanceRecord.findMany({
      where: { studentId, markedAt: { gte: weekStart, lt: weekEnd } },
      include: { session: { select: { createdAt: true } } },
    });
    const weekOntimeCount = weekOnlineScans.filter((r) => {
      const diff = r.markedAt.getTime() - r.session.createdAt.getTime();
      return diff >= 0 && diff <= ONTIME_MS;
    }).length;

    // Points trend: this week vs last week
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
    const [lastWeekOfflineCount, lastWeekOnlineCount] = await Promise.all([
      prisma.offlineAttendanceRecord.count({
        where: { studentId, scannedAt: { gte: lastWeekStart, lt: weekStart } },
      }),
      prisma.onlineAttendanceRecord.count({
        where: { studentId, markedAt: { gte: lastWeekStart, lt: weekStart } },
      }),
    ]);
    const thisWeekPts = weekScans.length * PTS.attend + weekOnlineScans.length * PTS.attend + weekOntimeCount * PTS.ontime;
    const lastWeekPts = (lastWeekOfflineCount + lastWeekOnlineCount) * PTS.attend;
    const pointsTrend = thisWeekPts - lastWeekPts;

    // Group leader count this week
    let weekGroupLeaderCount = 0;
    if (weekScans.length > 0) {
      const weekGLRows = await prisma.$queryRaw<[{ count: bigint }]>`
        WITH my_week AS (
          SELECT "unitCode", "lectureRoom", "sessionStart", "scannedAt"
          FROM "OfflineAttendanceRecord"
          WHERE "studentId" = ${studentId}
            AND "scannedAt" >= ${weekStart}
            AND "scannedAt" < ${weekEnd}
        ),
        my_group_mates AS (
          SELECT DISTINCT gm2."studentId"
          FROM "GroupMember" gm
          JOIN "GroupMember" gm2
            ON gm2."groupId" = gm."groupId"
            AND gm2."studentId" != ${studentId}
          WHERE gm."studentId" = ${studentId}
            AND gm."leftAt" IS NULL
            AND gm2."leftAt" IS NULL
        )
        SELECT COUNT(*)::int as count
        FROM my_week m
        WHERE NOT EXISTS (
          SELECT 1
          FROM "OfflineAttendanceRecord" other
          JOIN my_group_mates mgm ON mgm."studentId" = other."studentId"
          WHERE other."unitCode" = m."unitCode"
            AND other."lectureRoom" = m."lectureRoom"
            AND other."sessionStart" = m."sessionStart"
            AND other."scannedAt" < m."scannedAt"
        )
      `;
      weekGroupLeaderCount = Number(weekGLRows[0]?.count ?? 0);
    }

    const weeklyQuests = [
      {
        id: 'w1',
        name: 'Perfect Week',
        description: 'Attend all classes this week',
        progress: Math.min(weekDaysAttended, 5),
        target: 5,
        points: 100,
      },
      {
        id: 'w2',
        name: 'On-Time Streak',
        description: 'Check in on time 5 times this week',
        progress: Math.min(weekOntimeCount, 5),
        target: 5,
        points: 75,
      },
      {
        id: 'w3',
        name: 'Group Pioneer',
        description: 'Be first in your group 3 times this week',
        progress: Math.min(weekGroupLeaderCount, 3),
        target: 3,
        points: 60,
      },
    ];

    // ── 10. Build response ────────────────────────────────────────────────
    return NextResponse.json(
      {
        totalSessions: stats.totalSessions,
        attended: stats.attended,
        percent: stats.percent,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        perfectWeeks: stats.perfectWeeks,
        perfectMonths: stats.perfectMonths,
        ontimeCount: stats.ontimeCount,
        earlyBirdCount,
        comebacks: stats.comebacks,
        firstSessionDone: stats.firstSessionDone,
        unitsAbove90: stats.unitsAbove90,
        groupLeaderCount,
        rank: rank || totalStudents,
        totalStudents,
        rankTrend,
        points: augmentedTotal,
        pointsToday,
        pointsExpiring: 0,
        pointsTrend,
        newlyUnlockedBadge,
        leaderboard,
        dailyChallenges,
        weeklyQuests,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[achievements] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
