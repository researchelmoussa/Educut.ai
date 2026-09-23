-- EduCut.ai public catalogue export
--
-- Refreshes data/academies.txt and data/courses.txt, the source of the
-- static academy pages. Run each query in the Supabase SQL editor, copy the
-- single result cell into the matching file, then run:
--
--   node scripts/build-pages.mjs
--
-- Only public, published fields are exported. Prices, per-course target
-- audiences and the `objectives` column are intentionally left out.

-- data/academies.txt  (code | name | summary | audience | topics)
select string_agg(
  concat_ws(' | ', code, name, description, audience, array_to_string(topics, ', ')),
  E'\n' order by position, code)
from academies
where public_visibility;

-- data/courses.txt  (code | name | level | hours | online hours | personal-work hours | programme ¶ …)
select string_agg(
  concat_ws(' | ', code, name, level, duration_hours, duration_online_hours,
            duration_personal_work_hours, array_to_string(programme, ' ¶ ')),
  E'\n' order by academy_code, position, code)
from courses
where public_visibility;

-- data/assessment-focus.txt  (focus key | focus label | course codes in tier order)
-- The 14 focus areas the assessment scores; submit_assessment builds the
-- recommended paths from these courses.
select string_agg(line, E'\n' order by focus_key) from (
  select focus_key, concat_ws(' | ', focus_key, focus_label,
         string_agg(course_code, ', ' order by tier, course_code)) as line
  from assessment_focus_courses group by focus_key, focus_label
) t;

-- Catalogue-wide facts used on every academy page (scripts/build-pages.mjs, CATALOGUE_FACTS).
-- Re-check these if they change:
select language, translation_available, certification, count(*)
from courses where public_visibility
group by 1, 2, 3;
