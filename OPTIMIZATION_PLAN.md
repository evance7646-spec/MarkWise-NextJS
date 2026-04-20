# Option 3: Multi-Entry Modal Optimization Plan

## Performance Goals
- **Time Complexity**: O(1) for data lookups after initial fetch
- **Space Complexity**: Minimal with strategic caching
- **User Experience**: Rapid sequential entry addition

## Key Optimizations

### 1. Data Caching (O(1) lookups)
```
OLD: Re-fetch courses/units/lecturers every time modal opens
NEW: Cache on first open, reuse across all entries in session
- Saves 3 parallel API calls per entry (except first)
- ~500-1000ms saved per entry after first
```

### 2. Debounced Room Availability (Reduced API calls)
```
OLD: Fetch rooms on every day/time change
NEW: Debounce with 400ms delay
- Groups rapid field changes into single API call
- Prevents race conditions
- Typical: 3-4 calls → 1 call
```

### 3. Persistent Form State
```
OLD: Reset entire form between entries
NEW: Retain selections intelligently
- Same course? Keep course/year/semester selected
- Same lecturer? Keep lecturer selected
- Reset only: unit, time, room (most likely to vary)
- User can override any field
```

### 4. Memoized Derived Data (O(n) → O(1) cache)
```
- yearsForCourse: memoized based on courseId
- semestersForYear: memoized based on yearId
- filteredUnits: memoized based on semesterId
- Prevents re-computation on form state changes
```

### 5. Session Tracking
```
- Count entries added in current session
- Show visual feedback "Added 3 entries this session"
- Helps admins track progress
```

### 6. Smart Reset Strategy
```
After successful entry:
- Keep: courseId, yearId, lecturerId (most reusable)
- Reset: unitId, day, startTime, endTime, roomId, venueName
- User can quickly change only what differs
```

## Complexity Analysis

### Time Complexity
| Operation | Before | After | Saving |
|-----------|--------|-------|--------|
| Open modal (1st time) | O(3n) | O(3n) | — |
| Open modal (subsequent) | O(3n) | O(1)* | ~1s per entry |
| Room availability check | O(n) | O(1) debounced** | ~200-600ms |
| Derived data (years) | O(n) | O(1) | ~10-50ms |
| **Total per entry** | **~1500ms** | **~200ms** | **87% faster** |

*After cache hit
**Debounced, batches rapid changes

### Space Complexity
| Data | Space | Notes |
|------|-------|-------|
| Courses cache | O(n) | Fetch once, ~50-100 courses |
| Units cache | O(m) | Fetch once, ~200-500 units |
| Lecturers cache | O(p) | Fetch once, ~50-200 lecturers |
| Room results | O(1) | Always ~10-30 rooms (temporary) |
| Form state | O(1) | Fixed fields (string keys) |
| **Total** | **O(n+m+p)** | **~10KB typical** |

## Implementation Strategy

1. Add cached data state with timestamps
2. Add debounce utility for room fetching
3. Modify handleSubmit to keep modal open
4. Add "Save & Add Another" flow
5. Implement smart form reset logic
6. Add session counter display
7. Use useRef for debounce timers

## Expected Impact
- **Faster data entry**: 87% reduction in modal interaction time
- **Better UX**: No jarring close/reopen cycles
- **Reduced server load**: 50-70% fewer API calls per entry batch
- **Scalability**: Handles 10+ rapid entries without slowdown
