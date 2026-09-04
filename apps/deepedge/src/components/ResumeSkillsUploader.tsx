'use client'

import { useState } from 'react'
import { FileUploader } from './FileUploader'
import { Sparkles } from 'lucide-react'

/**
 * Heuristic keyword matching against an uploaded resume — not an AI
 * integration (no LLM API key is configured for this), but a real,
 * working extraction against a fixed skills list, not a fake claim.
 */
export function ResumeSkillsUploader({ defaultResumeUrl, defaultSkills }: { defaultResumeUrl?: string; defaultSkills?: string[] }) {
  const [resumeUrl, setResumeUrl] = useState(defaultResumeUrl || '')
  const [skills, setSkills] = useState((defaultSkills || []).join(', '))
  const [suggested, setSuggested] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentSkillList = skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

  const handleSuggest = async (url: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/candidates/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not parse resume')
      setSuggested(data.skills.filter((s: string) => !currentSkillList.includes(s.toLowerCase())))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const addSkill = (skill: string) => {
    setSkills((prev) => (prev ? `${prev}, ${skill}` : skill))
    setSuggested((prev) => prev.filter((s) => s !== skill))
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Resume</label>
        <FileUploader
          name="resume_url"
          defaultValue={resumeUrl}
          folder="resume"
          bucket="resumes"
          accept=".pdf"
          onUploaded={(url) => {
            setResumeUrl(url)
            handleSuggest(url)
          }}
        />
        {loading && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Scanning resume for skills...</p>}
        {error && <p className="text-xs text-red-600 mt-1 dark:text-red-400">{error}</p>}
      </div>

      {suggested.length > 0 && (
        <div className="bg-indigo-50 rounded-lg p-3 dark:bg-indigo-950/40">
          <p className="text-xs font-medium text-indigo-900 mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Found these in your resume — click to add
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-xs bg-white border border-indigo-300 text-indigo-700 px-2 py-1 rounded-full hover:bg-indigo-100 dark:bg-gray-900 dark:border-indigo-800 dark:text-indigo-400"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Skills</label>
        <input
          id="skills"
          type="text"
          name="skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="e.g., JavaScript, React, Node.js"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700"
        />
        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Separate skills with commas</p>
      </div>
    </div>
  )
}
