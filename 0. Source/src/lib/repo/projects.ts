import type { Project } from '../types';
import type { ProjectOverviewResponse } from '../projects';
import { http } from './http';
import { notifyMutation } from './events';

type NewProject = Omit<Project, 'id' | 'userId' | 'completedAt' | 'createdAt' | 'updatedAt'>;

export const listProjects = (): Promise<Project[]> => http.get<Project[]>('/api/projects');

export const getProjectsOverview = (): Promise<ProjectOverviewResponse> =>
  http.get<ProjectOverviewResponse>('/api/projects/overview');

export const createProject = async (data: NewProject): Promise<Project> => {
  const row = await http.post<Project>('/api/projects', data);
  notifyMutation('projects');
  return row;
};

export const updateProject = async (
  id: string,
  patch: Partial<NewProject>,
): Promise<Project> => {
  const row = await http.patch<Project>(`/api/projects/${id}`, patch);
  notifyMutation('projects');
  return row;
};

export const deleteProject = async (id: string): Promise<void> => {
  await http.del(`/api/projects/${id}`);
  notifyMutation('projects');
  notifyMutation('todos');
  notifyMutation('timeBlocks');
  notifyMutation('notes');
  notifyMutation('lifeEvents');
};
