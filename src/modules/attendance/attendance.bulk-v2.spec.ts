import { AttendanceService } from './attendance.service';

// In-memory stand-in for the TypeORM repository, so no database is touched.
function fakeRepo() {
  const rows: any[] = [];
  const day = (d: any) => new Date(d).toISOString().slice(0, 10);
  const matches = (r: any, where: any) =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'attendanceDate') return day(r[k]) === day(v);
      if (v && v.type === 'in') return v.value.includes(r[k]);
      return r[k] === v;
    });
  let n = 0;
  return {
    rows,
    findOne: async ({ where }) => rows.find((r) => matches(r, where)) ?? null,
    find: async ({ where }) => rows.filter((r) => matches(r, where)),
    merge: (a, b) => Object.assign(a, b),
    create: (x) => (Array.isArray(x) ? x.map((i) => ({ ...i })) : { ...x }),
    save: async (x) => {
      const one = (r) => {
        if (!r.attendanceId) {
          r.attendanceId = 'id-' + ++n;
          rows.push(r);
        }
        return r;
      };
      return Array.isArray(x) ? x.map(one) : one(x);
    },
  };
}

const anything = () => new Proxy({}, { get: () => jest.fn().mockResolvedValue(undefined) });
const COHORT = '11111111-1111-1111-1111-111111111111';
const today = new Date().toISOString().slice(0, 10);

function setup() {
  const repo = fakeRepo();
  const svc = new AttendanceService(repo as any, anything() as any, anything() as any);
  const call = async (eventId: string | null, marks: Record<string, string>, extra: any = {}) => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await svc.bulkAttendanceV2('t1', 'teacher', {
      attendanceDate: today,
      context: 'event',
      contextId: eventId,
      cohortId: COHORT,
      userAttendance: Object.entries(marks).map(([userId, attendance]) => ({ userId, attendance })),
      ...extra,
    } as any, res);
    return res;
  };
  const cohort = (userId: string) =>
    repo.rows.find((r) => r.userId === userId && r.context === 'cohort')?.attendance;
  return { repo, call, cohort };
}

describe('bulkAttendanceV2 live cohort sync (today)', () => {
  it('follows the 5-event day: any present event makes the cohort present', async () => {
    const { call, cohort } = setup();
    await call('E1', { A: 'present', B: 'absent' });
    expect([cohort('A'), cohort('B')]).toEqual(['present', 'absent']);
    await call('E2', { A: 'absent', B: 'absent' });
    expect([cohort('A'), cohort('B')]).toEqual(['present', 'absent']);
    await call('E3', { A: 'absent', B: 'present' });
    expect([cohort('A'), cohort('B')]).toEqual(['present', 'present']);
    await call('E4', { A: 'absent', B: 'absent' });
    await call('E5', { A: 'absent', B: 'absent' });
    expect([cohort('A'), cohort('B')]).toEqual(['present', 'present']);
  });

  it('flips the cohort back to absent when the only present event is corrected', async () => {
    const { call, cohort, repo } = setup();
    await call('E1', { A: 'present' });
    await call('E2', { A: 'absent' });
    await call('E1', { A: 'absent' });
    expect(cohort('A')).toBe('absent');
    expect(repo.rows.filter((r) => r.context === 'cohort')).toHaveLength(1);
  });

  it('keeps the cohort present if another event is still present', async () => {
    const { call, cohort } = setup();
    await call('E1', { A: 'present' });
    await call('E2', { A: 'present' });
    await call('E1', { A: 'absent' });
    expect(cohort('A')).toBe('present');
  });

  it('rejects event context without cohortId and saves nothing', async () => {
    const { call, repo } = setup();
    const res = await call('E1', { A: 'present' }, { cohortId: undefined });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(repo.rows).toHaveLength(0);
  });
});
