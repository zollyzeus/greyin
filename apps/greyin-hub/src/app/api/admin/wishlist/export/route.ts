import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: requests } = await supabase
    .from('feature_requests')
    .select('title, description, status, upvote_count, created_at, profiles:user_id ( full_name, email )')
    .order('upvote_count', { ascending: false })

  const header = ['title', 'description', 'status', 'upvote_count', 'submitted_by', 'submitted_email', 'created_at']
  const rows = (requests || []).map((r: any) => [
    r.title,
    r.description,
    r.status,
    r.upvote_count,
    r.profiles?.full_name,
    r.profiles?.email,
    r.created_at,
  ])
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="greyin-wishlist-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
