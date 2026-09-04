import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedCandidates, uniqueApproved } from '../cv-search-jobs.js';

test('17 approvals precede 13 highest ranked pending candidates without promoting them', () => {
  const approved = Array.from({length:17}, (_,i) => ({curriculumId:`a${i}`, classification:'approved', score:i}));
  const pending = Array.from({length:178}, (_,i) => ({curriculumId:`p${i}`, classification:'review', score:i}));
  const rows = recommendedCandidates([...pending, ...approved, {curriculumId:'r', classification:'rejected', score:1000}]);
  assert.equal(rows.length,30);
  assert.equal(uniqueApproved(rows).length,17);
  assert.ok(rows.slice(0,17).every(r => r.classification === 'approved'));
  assert.deepEqual(rows.slice(17).map(r=>r.score), Array.from({length:13},(_,i)=>177-i));
});

test('cross-group duplicates retain approved evidence, never fill with rejected or anonymous rows', () => {
  const rows = recommendedCandidates([
    {curriculumId:'1',classification:'review',score:99},
    {curriculumId:'1',classification:'approved',score:1},
    {curriculumId:'2',classification:'rejected',score:100},
    {classification:'review',score:100}
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].classification,'approved');
});
