ALTER TABLE classroom_students ADD COLUMN imported_password TEXT;
COMMENT ON COLUMN classroom_students.imported_password IS
    'Original CSV password retained for administrator distribution; not the current account password.';
