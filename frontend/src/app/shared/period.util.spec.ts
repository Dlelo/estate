import { periodSortKey, sortPeriodsAsc } from './period.util';

describe('periodSortKey', () => {
  it('orders monthly periods within a year', () => {
    expect(periodSortKey('2026-01')).toBeLessThan(periodSortKey('2026-02'));
    expect(periodSortKey('2026-11')).toBeLessThan(periodSortKey('2026-12'));
  });

  it('orders across year boundaries', () => {
    expect(periodSortKey('2025-12')).toBeLessThan(periodSortKey('2026-01'));
  });

  it('sorts an annual period after all of that year\'s months', () => {
    expect(periodSortKey('2026-12')).toBeLessThan(periodSortKey('2026'));
    expect(periodSortKey('2026')).toBeLessThan(periodSortKey('2027-01'));
  });

  it('sorts unrecognized formats first', () => {
    expect(periodSortKey('not-a-period')).toBe(0);
    expect(periodSortKey('not-a-period')).toBeLessThan(periodSortKey('2026-01'));
  });
});

describe('sortPeriodsAsc', () => {
  it('sorts a mixed list of monthly and annual periods ascending', () => {
    expect(sortPeriodsAsc(['2026-03', '2025', '2026-01', '2025-12'])).toEqual([
      '2025-12', '2025', '2026-01', '2026-03'
    ]);
  });

  it('does not mutate the input array', () => {
    const input = ['2026-02', '2026-01'];
    const result = sortPeriodsAsc(input);
    expect(input).toEqual(['2026-02', '2026-01']);
    expect(result).toEqual(['2026-01', '2026-02']);
  });
});
