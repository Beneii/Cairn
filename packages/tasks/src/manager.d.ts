import type { Task, TaskStatus } from "@cairn/shared";
export declare function getTasks(filter?: {
    status?: TaskStatus;
    source?: "user" | "cairn";
}): Task[];
export declare function getTask(id: string): Task | undefined;
export declare function getTasksForGoal(goalId: string): Task[];
export declare function createTask(task: Partial<Task> & {
    title: string;
}): Task;
export declare function updateTask(id: string, changes: Partial<Task>): Task | undefined;
export declare function deleteTask(id: string): boolean;
export declare function completeTask(id: string): Task | undefined;
//# sourceMappingURL=manager.d.ts.map