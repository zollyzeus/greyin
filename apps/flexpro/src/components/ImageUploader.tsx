'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus } from 'lucide-react'

/**
 * Progressive-enhancement pattern: the surrounding form is a plain server
 * component posting via native <form method="POST">, so this just needs to
 * get a public URL into a hidden input by the time the form submits — no
 * need to lift state up to a client-rendered form.
 */
export function ImageUploader({ name, defaultValue, folder }: { name: string; defaultValue?: string; folder: string }) {
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

    const { error: uploadError } = await supabase.storage.from('public-images').upload(path, file)
    setUploading(false)

    if (uploadError) {
      setError(uploadError.message)
      return
    }

    const { data } = supabase.storage.from('public-images').getPublicUrl(path)
    setUrl(data.publicUrl)
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-40 h-24 object-cover rounded mb-2 border border-gray-200" />
      )}
      <label className="inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
        <ImagePlus className="w-4 h-4" />
        <span>{uploading ? 'Uploading...' : url ? 'Change image' : 'Upload image'}</span>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
