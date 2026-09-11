'use server';

import type { DepartmentTask } from '@/lib/complaint-context';
import {
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './types';

export type CoordinationInput = {
  complaintId: string;
  category: string;
  description: string;
  primaryDepartmentId: string;
  primaryDepartmentName: string;
};

export type CoordinationOutput = {
  requiresMultiDepartment: boolean;
  departmentTasks: DepartmentTask[];
  reasoning: string;
  receipt: AgentLogEntry;
};

export async function coordinationAgent(input: CoordinationInput): Promise<CoordinationOutput> {
  const startTime = performance.now();
  const descLower = (input.description || '').toLowerCase();
  const catLower = (input.category || '').toLowerCase();
  const departmentTasks: DepartmentTask[] = [];

  let requiresMultiDepartment = false;
  let reasoning = 'Single department handling required.';
  let status: 'success' | 'fallback' | 'error' = 'success';

  try {
    // 1. Water Pipe Burst / Flooding scenario -> Water Supply + Engineering/Roads + Sanitation
    if (catLower.includes('water') || descLower.includes('pipe burst') || descLower.includes('water leak')) {
      requiresMultiDepartment = true;
      const task1Id = `TASK-${input.complaintId.slice(-4)}-01`;
      const task2Id = `TASK-${input.complaintId.slice(-4)}-02`;
      const task3Id = `TASK-${input.complaintId.slice(-4)}-03`;

      departmentTasks.push({
        id: task1Id,
        departmentId: 'dept_water',
        departmentName: 'Water Supply Department',
        taskName: 'Isolate main valve & repair pipe leak',
        status: 'In Progress',
        notes: 'Primary task: Shut off water valve to stop active flooding.',
      });

      departmentTasks.push({
        id: task2Id,
        departmentId: 'dept_traffic',
        departmentName: 'Road Maintenance Department',
        taskName: 'Resurface damaged road pavement',
        status: 'Blocked',
        dependencyTaskId: task1Id,
        notes: 'Blocked until water pipe isolation task is completed.',
      });

      if (descLower.includes('drain') || descLower.includes('sewage') || descLower.includes('waterlog')) {
        departmentTasks.push({
          id: task3Id,
          departmentId: 'dept_sanitation',
          departmentName: 'Solid Waste Management Department',
          taskName: 'Clear clogged stormwater drains',
          status: 'Pending',
          notes: 'Clear mud and debris from drainage outlets.',
        });
      }

      reasoning = 'Multi-department coordination initialized for water pipe burst (Water Supply, Road Maintenance, Sanitation).';
    } 
    // 2. Severe Road Cave-in / Traffic Hazard scenario -> Roads + Electrical + Traffic
    else if (catLower.includes('pothole') && (descLower.includes('cable') || descLower.includes('wire') || descLower.includes('traffic'))) {
      requiresMultiDepartment = true;
      const task1Id = `TASK-${input.complaintId.slice(-4)}-01`;
      const task2Id = `TASK-${input.complaintId.slice(-4)}-02`;

      departmentTasks.push({
        id: task1Id,
        departmentId: 'dept_electrical',
        departmentName: 'Electrical & Streetlight Department',
        taskName: 'Inspect and secure underground cables',
        status: 'In Progress',
        notes: 'Verify no active electrical hazard before road repair.',
      });

      departmentTasks.push({
        id: task2Id,
        departmentId: 'dept_traffic',
        departmentName: 'Road Maintenance Department',
        taskName: 'Fill pothole and apply asphalt patch',
        status: 'Blocked',
        dependencyTaskId: task1Id,
        notes: 'Blocked until electrical cable inspection is cleared.',
      });

      reasoning = 'Multi-department coordination initialized for road hazard with electrical cables.';
    }
    // Default: Single department primary task
    else {
      departmentTasks.push({
        id: `TASK-${input.complaintId.slice(-4)}-01`,
        departmentId: input.primaryDepartmentId,
        departmentName: input.primaryDepartmentName,
        taskName: `Resolve ${input.category} incident`,
        status: 'In Progress',
      });
    }
  } catch (err: any) {
    console.warn('[coordinationAgent] Execution error, applying single-department fallback:', err?.message);
    status = 'fallback';
    departmentTasks.length = 0;
    departmentTasks.push({
      id: `TASK-${input.complaintId.slice(-4)}-01`,
      departmentId: input.primaryDepartmentId,
      departmentName: input.primaryDepartmentName,
      taskName: `Resolve ${input.category} incident`,
      status: 'In Progress',
    });
    reasoning = 'Fallback coordination applied.';
  }

  const receipt = createAgentReceipt({
    agent: 'coordination_agent',
    status,
    startTime,
    model: 'multi_dept_rules',
    inputSummary: `ComplaintId: ${input.complaintId}, PrimaryDept: ${input.primaryDepartmentId}`,
    outputSummary: `RequiresMultiDepartment: ${requiresMultiDepartment}, SubTasksCreated: ${departmentTasks.length}`,
    confidence: 0.9,
    reasoning,
  });

  return {
    requiresMultiDepartment,
    departmentTasks,
    reasoning,
    receipt,
  };
}
