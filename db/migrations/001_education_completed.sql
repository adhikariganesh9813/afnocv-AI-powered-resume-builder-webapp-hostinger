-- Adds a completion flag to education entries.
--
-- An in-progress degree must never be written up as one already earned, and the
-- resume should show its end date as "(Expected)". Previously this was inferred
-- by pattern-matching the end-date text, which is fragile; the user now states
-- it directly.
--
-- Additive and safe to re-run: existing rows default to completed = 0.

ALTER TABLE education
  ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 0 AFTER end_date;

-- Rows created before this column existed: treat an end date that says so, or
-- that names a year still in the future, as in progress. Anything else is
-- assumed completed. Users can correct any row with the checkbox on the profile
-- page, so a wrong guess here is not sticky.
UPDATE education
SET completed = CASE
  WHEN end_date REGEXP 'expect|present|current|ongoing' THEN 0
  WHEN end_date REGEXP '[0-9]{4}'
       AND CAST(REGEXP_SUBSTR(end_date, '[0-9]{4}') AS UNSIGNED) > YEAR(CURDATE()) THEN 0
  ELSE 1
END;
