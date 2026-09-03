import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Code, ExternalLink, Github, Heart, PlusCircle, ClipboardList } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  idea: 'bg-yellow-100 text-yellow-700',
}

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('builder_projects')
    .select('id, title, description, tech_stack, github_url, demo_url, status, upvote_count, created_at, profiles:user_id ( full_name ), project_asks ( status )')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Hero */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Code className="h-12 w-12" />
            <h1 className="text-5xl font-bold">Projects</h1>
          </div>
          <p className="text-xl opacity-90 max-w-2xl mb-8">
            Real projects from senior Builders, with real open asks — not a decorative
            "looking for" tag. Apply to one and walk away with a verified record.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 bg-white text-teal-600 px-8 py-4 rounded-lg hover:bg-gray-100 font-bold text-lg"
          >
            <PlusCircle className="h-6 w-6" />
            Post a Project
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600 mb-6">{projects?.length || 0} projects</p>

        {projects && projects.length > 0 ? (
          <div className="space-y-6">
            {projects.map((project: any) => {
              const openAsks = (project.project_asks || []).filter((a: any) => a.status === 'open').length
              return (
                <div key={project.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Link href={`/projects/${project.id}`} className="text-2xl font-bold text-gray-900 hover:text-teal-600">
                      {project.title}
                    </Link>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[project.status] || STATUS_STYLES.idea}`}>
                      {project.status === 'in_progress' ? 'In Progress' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                    {openAsks > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {openAsks} open {openAsks === 1 ? 'ask' : 'asks'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <span>{project.profiles?.full_name || 'Builder'}</span>
                    <span>•</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>

                  <p className="text-gray-700 mb-4">{project.description}</p>

                  {project.tech_stack && project.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.tech_stack.map((tech: string) => (
                        <span key={tech} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4">
                      {project.github_url && (
                        <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-gray-700 hover:text-teal-600 text-sm font-semibold">
                          <Github className="h-4 w-4" />
                          GitHub
                        </a>
                      )}
                      {project.demo_url && (
                        <a href={project.demo_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-gray-700 hover:text-teal-600 text-sm font-semibold">
                          <ExternalLink className="h-4 w-4" />
                          Live Demo
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {project.upvote_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Code className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600">Be the first Builder to post one</p>
          </div>
        )}
      </div>
    </main>
  )
}
