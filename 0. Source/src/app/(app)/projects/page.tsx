import { ProjectsPage } from '@/components/projects/ProjectsPage';

export default async function ProjectsRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return <ProjectsPage initialProjectId={project} />;
}
