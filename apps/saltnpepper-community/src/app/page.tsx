import { MessageCircle, Heart, Users } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from '@/components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'saltnpepper')

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-800 dark:to-pink-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-semibold mb-6">Join the Conversation</h1>
          <p className="text-xl">Connect with professionals, share ideas, and grow together</p>
          <a href="https://greyin.net/#demo" className="inline-block mt-6 text-sm text-purple-50 underline hover:text-white transition">
            Or explore as a demo user — no signup needed
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <MessageCircle className="h-12 w-12 text-purple-600 dark:text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Active Discussions</h3>
            <p className="text-gray-600 dark:text-gray-400">Engage in meaningful conversations</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <Users className="h-12 w-12 text-purple-600 dark:text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Community Members</h3>
            <p className="text-gray-600 dark:text-gray-400">Connect with like-minded professionals</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <Heart className="h-12 w-12 text-pink-600 dark:text-pink-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Support & Learn</h3>
            <p className="text-gray-600 dark:text-gray-400">Get help and share knowledge</p>
          </div>
        </div>
      </div>

      {/* Ecosystem cross-link -- previously only deepedge's homepage
          promoted the other pillars. */}
      <div className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">One login, five more platforms</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {OTHER_PILLARS.map((p) => (
              <a key={p.key} href={p.url} className="block rounded-xl border-2 bg-white dark:bg-gray-950 hover:shadow-lg dark:hover:shadow-none transition-shadow p-5" style={{ borderColor: p.color }}>
                <span className="w-2.5 h-2.5 rounded-full inline-block mb-3" style={{ backgroundColor: p.color }} aria-hidden="true" />
                <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">{p.label}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
