-- Normalize any existing unit_code values: strip whitespace, uppercase
UPDATE "MeetingInvite"
SET "unitCode" = UPPER(REGEXP_REPLACE("unitCode", '\s+', '', 'g'))
WHERE "unitCode" ~ '\s' OR "unitCode" != UPPER("unitCode");

-- Enforce normalized format going forward
ALTER TABLE "MeetingInvite"
  ADD CONSTRAINT "chk_unitCode_normalized"
  CHECK ("unitCode" = UPPER(REGEXP_REPLACE("unitCode", '\s+', '', 'g')));
