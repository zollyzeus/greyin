import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Heuristic keyword matching, not an AI/LLM integration — no model API key
// is configured anywhere in this deployment, so this is a real, working
// extraction against a fixed list rather than a fabricated "AI parsing"
// claim. Covers common technical + domain skills relevant to DeepEdge's
// senior-engineering audience.
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'LLM', 'NLP',
  'Embedded Systems', 'AUTOSAR', 'CAN Bus', 'RTOS', 'Firmware', 'C',
  'System Design', 'Microservices', 'Distributed Systems', 'Kafka',
  'Product Management', 'Agile', 'Scrum', 'Leadership', 'Mentoring',
  'Solidity', 'Blockchain', 'Cybersecurity', 'DevOps', 'Linux',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { resumeUrl } = await request.json()
  if (!resumeUrl) {
    return NextResponse.json({ error: 'resumeUrl is required' }, { status: 400 })
  }

  try {
    // resumeUrl was built client-side from NEXT_PUBLIC_SUPABASE_URL (the
    // browser-reachable host) and stored as-is — fine for a browser to
    // re-fetch, but this fetch runs server-side, inside the container,
    // where that host isn't necessarily reachable (see
    // lib/supabase/server.ts's SUPABASE_INTERNAL_URL comment for the full
    // story). Swap in the internal host for this one server-side fetch
    // only; unset in production, so this is a no-op there.
    const internalUrl = process.env.SUPABASE_INTERNAL_URL
    const fetchUrl = internalUrl
      ? resumeUrl.replace(process.env.NEXT_PUBLIC_SUPABASE_URL!, internalUrl)
      : resumeUrl
    const fileRes = await fetch(fetchUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Could not download resume' }, { status: 400 })
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    // Lazy-required: pdf-parse's own test-fixture loading at import time
    // misbehaves in some bundling setups when imported at module scope.
    const pdfParse = (await import('pdf-parse')).default
    const parsed = await pdfParse(buffer)
    const text = parsed.text.toLowerCase()

    const matched = KNOWN_SKILLS.filter((skill) => text.includes(skill.toLowerCase()))

    return NextResponse.json({ skills: matched })
  } catch (error) {
    console.error('Resume parsing failed:', error)
    return NextResponse.json({ error: 'Could not parse this resume — is it a valid PDF?' }, { status: 400 })
  }
}
