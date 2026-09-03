import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, Tag } from 'lucide-react'

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, description, color, posts:posts(count)')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
            <nav className="flex gap-6">
              <Link href="/" className="text-gray-700 hover:text-blue-600">Home</Link>
              <Link href="/categories" className="text-blue-600 font-semibold">Categories</Link>
              <Link href="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Categories</h1>

        {categories && categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category: any) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Tag className="h-5 w-5" style={{ color: category.color || '#2563eb' }} />
                  <h3 className="font-semibold text-gray-900">{category.name}</h3>
                </div>
                {category.description && (
                  <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                )}
                <p className="text-xs text-gray-400">{category.posts?.[0]?.count || 0} articles</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No categories yet</p>
          </div>
        )}
      </div>
    </main>
  )
}
