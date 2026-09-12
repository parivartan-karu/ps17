import { validateStatusTransition } from './state-machine';
import { isOpenLowPriorityTask } from './worker-api';
import type { Report } from './types';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const base: Report = { id: 'TEST', userId: 'u', userName: 'Citizen', location: 'Pune', description: 'Streetlight not working', imageUrl: 'data:image/png;base64,test', imageHint: 'streetlight', timestamp: new Date().toISOString(), status: 'Submitted', department: 'Electrical', departmentId: 'dept_electrical', category: 'Streetlight', priority: 'Low', difficulty: 'Easy' };
assert(isOpenLowPriorityTask(base, 'dept_electrical'), 'Easy low-priority task is worker-claimable in matching department');
assert(!isOpenLowPriorityTask({ ...base, difficulty: 'Hard' }, 'dept_electrical'), 'Hard task is not self-claimable');
assert(!isOpenLowPriorityTask(base, 'dept_water'), 'Wrong department cannot self-claim');
assert(validateStatusTransition('Assigned', 'In Progress').valid, 'Assigned -> In Progress is valid');
assert(validateStatusTransition('In Progress', 'Under Verification').valid, 'Worker completion -> verification is valid');
assert(!validateStatusTransition('Under Verification', 'Resolved', [{ id: 't', departmentId: 'd', departmentName: 'D', taskName: 'T', status: 'Pending' }]).valid, 'Unfinished subtask blocks resolution');
assert(validateStatusTransition('Under Verification', 'Resolved', [{ id: 't', departmentId: 'd', departmentName: 'D', taskName: 'T', status: 'Completed' }]).valid, 'Completed subtask allows resolution');
console.log('Workflow contract tests passed.');
