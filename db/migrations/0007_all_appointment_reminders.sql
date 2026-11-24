INSERT OR IGNORE INTO appointment_reminders
  (id, tenant_id, appointment_id, kind, remind_at, sent_at, created_at)
SELECT lower(hex(randomblob(16))), tenant_id, id, '24h',
       strftime('%Y-%m-%dT%H:%M:%fZ', start_at, '-24 hours'),
       NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM appointments
WHERE status = 'confirmed'
  AND strftime('%Y-%m-%dT%H:%M:%fZ', start_at, '-24 hours') > strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT OR IGNORE INTO appointment_reminders
  (id, tenant_id, appointment_id, kind, remind_at, sent_at, created_at)
SELECT lower(hex(randomblob(16))), tenant_id, id, '15m',
       strftime('%Y-%m-%dT%H:%M:%fZ', start_at, '-15 minutes'),
       NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM appointments
WHERE status = 'confirmed'
  AND strftime('%Y-%m-%dT%H:%M:%fZ', start_at, '-15 minutes') > strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
