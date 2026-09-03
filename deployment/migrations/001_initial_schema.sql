-- ============================================================
-- Supabase Initial Schema - Greyin Platform
-- ============================================================
-- 
-- This migration sets up the core database schema for all
-- 4 pillars of the Greyin platform:
--   1. Greyin B2B (Recruitment)
--   2. GreyMatters (Blog)
--   3. FreeAgent (Marketplace)
--   4. Community (Forum integration)
--
-- Run this after Supabase is deployed via Studio SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================================
-- 1. USER PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('candidate', 'client', 'freelancer', 'admin', 'author')) DEFAULT 'candidate',
  bio TEXT,
  location TEXT,
  website TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  twitter_handle TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. GREYIN B2B - RECRUITMENT
-- ============================================================

-- Companies/Clients
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  website TEXT,
  logo_url TEXT,
  location TEXT,
  founded_year INTEGER,
  linkedin_url TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One company per user
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies are viewable by everyone"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own company"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company"
  ON public.companies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  education TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  current_title TEXT,
  current_company TEXT,
  availability TEXT CHECK (availability IN ('immediate', '2weeks', '1month', 'not_available')) DEFAULT 'immediate',
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  currency TEXT DEFAULT 'USD',
  remote_preference TEXT CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')) DEFAULT 'flexible',
  willing_to_relocate BOOLEAN DEFAULT false,
  visa_sponsorship_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates viewable by authenticated users"
  ON public.candidates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own candidate profile"
  ON public.candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidate profile"
  ON public.candidates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Job Postings
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  responsibilities TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  nice_to_have TEXT[] DEFAULT '{}',
  skills_required TEXT[] DEFAULT '{}',
  experience_min INTEGER,
  experience_max INTEGER,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT DEFAULT 'USD',
  salary_disclosed BOOLEAN DEFAULT false,
  location TEXT,
  remote_type TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite')) DEFAULT 'hybrid',
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')) DEFAULT 'full-time',
  category TEXT,
  status TEXT CHECK (status IN ('draft', 'open', 'closed', 'filled')) DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  views_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs are viewable by everyone"
  ON public.jobs FOR SELECT
  USING (status IN ('open', 'filled'));

CREATE POLICY "Company owners can manage their jobs"
  ON public.jobs FOR ALL
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Job Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.candidates ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('submitted', 'reviewing', 'shortlisted', 'interview', 'offer', 'rejected', 'accepted', 'withdrawn')) DEFAULT 'submitted',
  cover_letter TEXT,
  resume_url TEXT,
  expected_salary INTEGER,
  available_from DATE,
  notes TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can view their own applications"
  ON public.applications FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.candidates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Candidates can insert applications"
  ON public.applications FOR INSERT
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM public.candidates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can view applications for their jobs"
  ON public.applications FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Companies can update application status"
  ON public.applications FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
      )
    )
  );

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. GREYMATTERS - BLOG
-- ============================================================

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Blog Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  category_id UUID REFERENCES public.categories ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authors can view their own posts"
  ON public.posts FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Authors can insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('author', 'admin')
    )
  );

CREATE POLICY "Authors can update their own posts"
  ON public.posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.posts ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.comments ON DELETE CASCADE,
  status TEXT CHECK (status IN ('approved', 'pending', 'spam')) DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. FREEAGENT - MARKETPLACE
-- ============================================================

-- Gig Categories
CREATE TABLE public.gig_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gig_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gig categories viewable by everyone"
  ON public.gig_categories FOR SELECT
  USING (true);

-- Gigs
CREATE TABLE public.gigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.gig_categories ON DELETE SET NULL,
  subcategory TEXT,
  pricing_type TEXT CHECK (pricing_type IN ('fixed', 'hourly', 'project')) DEFAULT 'fixed',
  price_min INTEGER,
  price_max INTEGER,
  currency TEXT DEFAULT 'USD',
  delivery_days INTEGER,
  revisions_included INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  what_you_get TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('active', 'paused', 'closed')) DEFAULT 'active',
  featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  rating_average NUMERIC(3,2) DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active gigs are viewable by everyone"
  ON public.gigs FOR SELECT
  USING (status = 'active');

CREATE POLICY "Freelancers can view their own gigs"
  ON public.gigs FOR SELECT
  USING (freelancer_id = auth.uid());

CREATE POLICY "Freelancers can insert gigs"
  ON public.gigs FOR INSERT
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update their own gigs"
  ON public.gigs FOR UPDATE
  USING (auth.uid() = freelancer_id);

CREATE TRIGGER gigs_updated_at
  BEFORE UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Gig Orders
CREATE TABLE public.gig_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID REFERENCES public.gigs ON DELETE SET NULL NOT NULL,
  client_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  freelancer_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'delivered', 'revision_requested', 'completed', 'cancelled', 'disputed')) DEFAULT 'pending',
  requirements TEXT,
  delivery_url TEXT,
  delivery_message TEXT,
  client_notes TEXT,
  freelancer_notes TEXT,
  due_date TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gig_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their orders"
  ON public.gig_orders FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Freelancers can view their orders"
  ON public.gig_orders FOR SELECT
  USING (auth.uid() = freelancer_id);

CREATE POLICY "Clients can create orders"
  ON public.gig_orders FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Participants can update orders"
  ON public.gig_orders FOR UPDATE
  USING (auth.uid() IN (client_id, freelancer_id));

CREATE TRIGGER gig_orders_updated_at
  BEFORE UPDATE ON public.gig_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Reviews
CREATE TABLE public.gig_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.gig_orders ON DELETE CASCADE NOT NULL,
  gig_id UUID REFERENCES public.gigs ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

ALTER TABLE public.gig_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
  ON public.gig_reviews FOR SELECT
  USING (true);

CREATE POLICY "Clients can review completed orders"
  ON public.gig_reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.gig_orders
      WHERE id = order_id AND client_id = auth.uid() AND status = 'completed'
    )
  );

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Companies
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_companies_slug ON public.companies(slug);

-- Jobs
CREATE INDEX idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_slug ON public.jobs(slug);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN(skills_required);

-- Applications
CREATE INDEX idx_applications_job_id ON public.applications(job_id);
CREATE INDEX idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX idx_applications_status ON public.applications(status);

-- Posts
CREATE INDEX idx_posts_author_id ON public.posts(author_id);
CREATE INDEX idx_posts_slug ON public.posts(slug);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_published_at ON public.posts(published_at DESC);
CREATE INDEX idx_posts_tags ON public.posts USING GIN(tags);

-- Comments
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- Gigs
CREATE INDEX idx_gigs_freelancer_id ON public.gigs(freelancer_id);
CREATE INDEX idx_gigs_category_id ON public.gigs(category_id);
CREATE INDEX idx_gigs_slug ON public.gigs(slug);
CREATE INDEX idx_gigs_status ON public.gigs(status);
CREATE INDEX idx_gigs_tags ON public.gigs USING GIN(tags);

-- Orders
CREATE INDEX idx_gig_orders_gig_id ON public.gig_orders(gig_id);
CREATE INDEX idx_gig_orders_client_id ON public.gig_orders(client_id);
CREATE INDEX idx_gig_orders_freelancer_id ON public.gig_orders(freelancer_id);
CREATE INDEX idx_gig_orders_status ON public.gig_orders(status);

-- ============================================================
-- SEED DATA (Optional)
-- ============================================================

-- Insert default categories for blog
INSERT INTO public.categories (name, slug, description, color) VALUES
('Technology', 'technology', 'Tech news and tutorials', '#3B82F6'),
('Career', 'career', 'Career advice and tips', '#10B981'),
('Industry', 'industry', 'Industry insights', '#8B5CF6'),
('Company News', 'company-news', 'Company updates', '#F59E0B');

-- Insert default gig categories
INSERT INTO public.gig_categories (name, slug, icon) VALUES
('Web Development', 'web-development', '💻'),
('Mobile Development', 'mobile-development', '📱'),
('Design', 'design', '🎨'),
('Writing', 'writing', '✍️'),
('Marketing', 'marketing', '📢'),
('Consulting', 'consulting', '🎯');

-- ============================================================
-- DONE!
-- ============================================================

-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
