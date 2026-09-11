'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus, X } from 'lucide-react'

/**
 * Repeatable variant of flexpro's ImageUploader.tsx, adapted
 * for builder_projects.images (text[]) rather than a single URL column.
 * Progressive-enhancement pattern still holds: the surrounding form is a
 * plain server component posting via native <form method="POST">, so this
 * just needs one hidden `images` input per uploaded URL by submit time --
 * formData.getAll('images') on the server collects them all.
 */
export function MultiImageUploader({ name, folder }: { name: string; folder: string }) {
  const [urls, setUrls] = useState<string[]>([])
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
    setUrls((prev) => [...prev, data.publicUrl])
    e.target.value = ''
  }

  const removeAt = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div>
      {urls.map((url, i) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <div key={url} className="relative">
              <img src={url} alt="" className="w-24 h-24 object-cover rounded border border-gray-200 dark:border-gray-800" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className={`inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 dark:text-gray-400 dark:border-gray-700 ${uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
        <ImagePlus className="w-4 h-4" />
        <span>{uploading ? 'Uploading...' : 'Add image'}</span>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden dark:bg-gray-950 dark:text-gray-100" disabled={uploading} />
      </label>
      {error && <p className="text-xs text-red-600 mt-1 dark:text-red-400">{error}</p>}
    </div>
  )
}
