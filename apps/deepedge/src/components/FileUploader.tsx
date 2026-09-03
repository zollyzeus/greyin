'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload } from 'lucide-react'

/**
 * Generic version of the ImageUploader pattern used in GreyMatters/
 * FlexPro/StackWorks. Every path is scoped under the uploader's own
 * user id (`${user.id}/${folder}/...`) -- required by each bucket's own
 * RLS INSERT policy (065_reference_checks-era pattern, extended to
 * storage in 071), which only permits writing under your own id.
 *
 * `bucket="resumes"` (071_private_resumes_bucket.sql) is private --
 * getPublicUrl() would return an unusable link for it, so this uses a
 * signed URL instead (30-day expiry, matching the existing "paste any
 * URL, including one that might later 404" UX this form already had --
 * see jobs/[id]/apply/page.tsx, which lets the URL be freely edited).
 * Everything else keeps using the genuinely-public public-images bucket.
 */
export function FileUploader({
  name,
  defaultValue,
  folder,
  accept,
  bucket = 'public-images',
  onUploaded,
}: {
  name: string
  defaultValue?: string
  folder: string
  accept: string
  bucket?: 'public-images' | 'resumes'
  onUploaded?: (url: string) => void
}) {
  const [url, setUrl] = useState(defaultValue || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      setError('You must be signed in to upload a file.')
      return
    }
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    setUploading(false)

    if (uploadError) {
      setError(uploadError.message)
      return
    }

    if (bucket === 'resumes') {
      const { data, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30)
      if (signError || !data) {
        setError(signError?.message || 'Could not generate a link for the uploaded file.')
        return
      }
      setUrl(data.signedUrl)
      onUploaded?.(data.signedUrl)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    setUrl(data.publicUrl)
    onUploaded?.(data.publicUrl)
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      {url && <p className="text-xs text-green-700 mb-2">File uploaded ✓</p>}
      <label className="inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
        <Upload className="w-4 h-4" />
        <span>{uploading ? 'Uploading...' : url ? 'Replace file' : 'Upload file'}</span>
        <input type="file" accept={accept} onChange={handleFile} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
