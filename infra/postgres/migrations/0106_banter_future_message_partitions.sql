-- 0106_banter_future_message_partitions.sql
-- Why: Pre-create monthly partitions for 2027 and first half of 2028 so message inserts never hit a missing partition. Worker job creates further partitions on demand.
-- Client impact: none. DDL only. No-ops gracefully on clusters where `banter_messages` is still a plain (non-partitioned) table; those clusters will start applying partitions once the parent-table conversion migration ships.

DO $$
DECLARE
  is_partitioned BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    WHERE c.relname = 'banter_messages'
  ) INTO is_partitioned;

  IF NOT is_partitioned THEN
    RAISE NOTICE 'banter_messages is not a partitioned parent, skipping partition pre-creation (Wave 2.12 helper handles this at runtime)';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS banter_messages_2027_01 PARTITION OF banter_messages FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_02 PARTITION OF banter_messages FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_03 PARTITION OF banter_messages FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_04 PARTITION OF banter_messages FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_05 PARTITION OF banter_messages FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_06 PARTITION OF banter_messages FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_07 PARTITION OF banter_messages FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_08 PARTITION OF banter_messages FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_09 PARTITION OF banter_messages FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_10 PARTITION OF banter_messages FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_11 PARTITION OF banter_messages FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2027_12 PARTITION OF banter_messages FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

  CREATE TABLE IF NOT EXISTS banter_messages_2028_01 PARTITION OF banter_messages FOR VALUES FROM ('2028-01-01') TO ('2028-02-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2028_02 PARTITION OF banter_messages FOR VALUES FROM ('2028-02-01') TO ('2028-03-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2028_03 PARTITION OF banter_messages FOR VALUES FROM ('2028-03-01') TO ('2028-04-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2028_04 PARTITION OF banter_messages FOR VALUES FROM ('2028-04-01') TO ('2028-05-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2028_05 PARTITION OF banter_messages FOR VALUES FROM ('2028-05-01') TO ('2028-06-01');
  CREATE TABLE IF NOT EXISTS banter_messages_2028_06 PARTITION OF banter_messages FOR VALUES FROM ('2028-06-01') TO ('2028-07-01');
END $$;
