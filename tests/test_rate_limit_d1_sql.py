import os
import sqlite3
import tempfile
import threading
import unittest

# This executes the same single-statement UPSERT/RETURNING SQL used by
# functions/_shared/account-api.js against SQLite, the SQL engine underlying D1.
# It is a local compatibility/concurrency check, not a live Cloudflare D1 test.
WRONG_ATTEMPT_SQL = """UPDATE verification_codes SET attempts=attempts+1
WHERE id=? AND attempts<? AND verified_at IS NULL
  AND consumed_at IS NULL AND expires_at>?
RETURNING attempts"""

VERIFY_CODE_SQL = """UPDATE verification_codes SET verified_at=?
WHERE id=? AND attempts<? AND verified_at IS NULL
  AND consumed_at IS NULL AND expires_at>?
RETURNING id"""

RATE_LIMIT_SQL = '''INSERT INTO rate_limits(rate_key, window_start, request_count)
VALUES (?, ?, 1)
ON CONFLICT(rate_key) DO UPDATE SET
  request_count = CASE
    WHEN rate_limits.window_start <= ? THEN 1
    WHEN rate_limits.request_count <= ? THEN rate_limits.request_count + 1
    ELSE rate_limits.request_count
  END,
  window_start = CASE
    WHEN rate_limits.window_start <= ? THEN excluded.window_start
    ELSE rate_limits.window_start
  END
RETURNING request_count, window_start'''


class RateLimitSqlTests(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        with sqlite3.connect(self.path) as db:
            db.execute("CREATE TABLE rate_limits (rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL)")
            db.execute("CREATE TABLE verification_codes (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, verified_at INTEGER, consumed_at INTEGER, expires_at INTEGER NOT NULL)")

    def tearDown(self):
        os.unlink(self.path)

    def hit(self, key, now, limit=3, window=3600):
        db = sqlite3.connect(self.path, timeout=20, isolation_level=None)
        try:
            row = db.execute(RATE_LIMIT_SQL, (key, now, now - window, limit, now - window)).fetchone()
            allowed = row is not None and row[0] <= limit
            retry = 0 if allowed else max(1, row[1] + window - now) if row else window
            return allowed, retry
        finally:
            db.close()

    def test_limit_caps_counter_and_returns_retry(self):
        results = [self.hit("contact", 10000) for _ in range(5)]
        self.assertEqual([result[0] for result in results], [True, True, True, False, False])
        self.assertEqual(results[3][1], 3600)
        with sqlite3.connect(self.path) as db:
            count = db.execute("SELECT request_count FROM rate_limits WHERE rate_key=?", ("contact",)).fetchone()[0]
        self.assertEqual(count, 4)  # limit + one rejected attempt, then capped

    def test_expired_window_resets_counter(self):
        self.hit("contact", 10000)
        self.hit("contact", 10001)
        allowed, retry = self.hit("contact", 13600)
        self.assertTrue(allowed)
        self.assertEqual(retry, 0)
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT request_count, window_start FROM rate_limits WHERE rate_key=?", ("contact",)).fetchone()
        self.assertEqual(row, (1, 13600))

    def test_concurrent_requests_do_not_exceed_allowed_count(self):
        barrier = threading.Barrier(40)
        results = []
        lock = threading.Lock()

        def worker():
            barrier.wait()
            result = self.hit("same-contact", 20000)
            with lock:
                results.append(result)

        threads = [threading.Thread(target=worker) for _ in range(40)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(sum(1 for allowed, _ in results if allowed), 3)
        with sqlite3.connect(self.path) as db:
            count = db.execute("SELECT request_count FROM rate_limits WHERE rate_key=?", ("same-contact",)).fetchone()[0]
        self.assertEqual(count, 4)  # three allowed; first rejected request records the cap


    def test_concurrent_wrong_codes_cannot_exceed_attempt_cap(self):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO verification_codes(id, attempts, expires_at) VALUES('code', 0, 99999)")
        barrier = threading.Barrier(40)
        results = []
        lock = threading.Lock()

        def worker():
            barrier.wait()
            with sqlite3.connect(self.path, timeout=20, isolation_level=None) as db:
                row = db.execute(WRONG_ATTEMPT_SQL, ("code", 5, 20000)).fetchone()
            with lock:
                results.append(row)

        threads = [threading.Thread(target=worker) for _ in range(40)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(sum(row is not None for row in results), 5)
        with sqlite3.connect(self.path) as db:
            attempts = db.execute("SELECT attempts FROM verification_codes WHERE id='code'").fetchone()[0]
        self.assertEqual(attempts, 5)

    def test_only_one_concurrent_correct_code_transition_succeeds(self):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO verification_codes(id, attempts, expires_at) VALUES('code', 0, 99999)")
        barrier = threading.Barrier(20)
        results = []
        lock = threading.Lock()

        def worker():
            barrier.wait()
            with sqlite3.connect(self.path, timeout=20, isolation_level=None) as db:
                row = db.execute(VERIFY_CODE_SQL, (20000, "code", 5, 20000)).fetchone()
            with lock:
                results.append(row)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(sum(row is not None for row in results), 1)
        with sqlite3.connect(self.path) as db:
            verified_at = db.execute("SELECT verified_at FROM verification_codes WHERE id='code'").fetchone()[0]
        self.assertEqual(verified_at, 20000)

    def test_expired_code_cannot_increment_attempts_or_verify(self):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO verification_codes(id, attempts, expires_at) VALUES('expired', 0, 100)")
            wrong = db.execute(WRONG_ATTEMPT_SQL, ("expired", 5, 200)).fetchone()
            correct = db.execute(VERIFY_CODE_SQL, (200, "expired", 5, 200)).fetchone()
        self.assertIsNone(wrong)
        self.assertIsNone(correct)

if __name__ == "__main__":
    unittest.main(verbosity=2)
