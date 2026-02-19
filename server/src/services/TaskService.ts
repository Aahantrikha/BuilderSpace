// Stub file - actual implementation in TaskService.ts.bak
export class TaskService {
  async createTask(data: any) {
    throw new Error('TaskService not implemented');
  }
  async getTasks(spaceId: string, userId: string) {
    throw new Error('TaskService not implemented');
  }
  async updateTaskStatus(data: any) {
    throw new Error('TaskService not implemented');
  }
  async deleteTask(taskId: string, userId: string) {
    throw new Error('TaskService not implemented');
  }
}

export const taskService = new TaskService();
