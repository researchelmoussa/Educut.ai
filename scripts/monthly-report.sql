-- EduCut.ai — monthly conversion report (SEO/GEO monitoring, see MONITORING.md)
--
-- Read-only: every statement is a SELECT. Run each query in the Supabase
-- SQL editor on the first working day of the month and copy the results into
-- the monthly log. Results are aggregated; no personal data is returned.
--
-- Covers the last 12 months. Change `interval '12 months'` to widen it.

-- 1. Conversions per month (the three website conversions + new leads)
with months as (
  select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as month
)
select
  to_char(m.month, 'YYYY-MM') as month,
  (select count(*) from assessment_submissions s where date_trunc('month', s.created_at) = m.month) as assessments,
  (select count(*) from assessment_submissions s where date_trunc('month', s.created_at) = m.month and s.completed_at is not null) as assessments_completed,
  (select count(*) from consultations c where date_trunc('month', c.created_at) = m.month) as consultations_booked,
  (select count(*) from consultations c where date_trunc('month', c.created_at) = m.month and c.status::text = 'COMPLETED') as consultations_held,
  (select count(*) from catalogue_requests r where date_trunc('month', r.requested_at) = m.month) as catalogue_requests,
  (select count(*) from catalogue_requests r where date_trunc('month', r.requested_at) = m.month and r.download_count > 0) as catalogues_downloaded,
  (select count(*) from leads l where date_trunc('month', l.created_at) = m.month) as new_leads
from months m
order by m.month desc;

-- 2. Lead journey: how leads first arrived (by form) and what they did next
select
  coalesce(first_source, 'unknown') as first_form,
  count(*) as leads,
  count(*) filter (where assessment_completed) as completed_assessment,
  count(*) filter (where consultation_requested) as requested_consultation,
  count(*) filter (where catalogue_requested) as requested_catalogue,
  count(*) filter (where converted_profile_id is not null) as became_customers
from leads
where created_at >= now() - interval '12 months'
group by 1
order by leads desc;

-- 3. AI maturity of assessed organizations, per month
select
  to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
  coalesce(maturity_label, 'unknown') as maturity_level,
  count(*) as assessments,
  round(avg(maturity_score)) as avg_score
from assessment_submissions
where created_at >= now() - interval '12 months'
group by 1, 2
order by 1 desc, 2;

-- 4. Strongest opportunity: most frequent top focus area (what the market asks for)
select
  s.focus_areas -> 0 ->> 'label' as top_focus_area,
  count(*) as assessments
from assessment_submissions s
where s.created_at >= now() - interval '12 months'
  and jsonb_typeof(s.focus_areas) = 'array'
group by 1
order by 2 desc;

-- 5. Recommended path size (3, 5 or 7 courses) chosen for each assessment
select
  recommended_path,
  count(*) as assessments
from assessment_submissions
where created_at >= now() - interval '12 months'
group by 1
order by 1;
