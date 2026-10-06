"""Kiểm thử bộ chấm độc lập (không cần Master): 7 nhãn kết quả và các trường hợp biên."""

import json
import os
import shutil
import unittest

from judgement import scanner
from judgement.checker import compare_lines, compare_tokens
from judgement.judge import Judge, Task

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = os.path.join(ROOT, "samples")
HAS_GXX = shutil.which("g++") is not None and os.name == "posix"


def load_problem():
    with open(os.path.join(SAMPLES, "aplusb.json"), encoding="utf-8") as f:
        return json.load(f)


def task_for(source, sid="t", **overrides):
    payload = {**load_problem(), "submissionId": sid, "sourceCode": source, **overrides}
    return Task.from_payload(payload)


@unittest.skipUnless(HAS_GXX, "cần g++ trên Linux")
class SamplesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.judge = Judge()

    def judge_sample(self, name):
        with open(os.path.join(SAMPLES, name), encoding="utf-8") as f:
            events = []
            result = self.judge.judge(task_for(f.read(), sid=name), events.append)
        return result, events

    def test_seven_verdicts(self):
        for verdict in ["AC", "WA", "TLE", "MLE", "CE", "RTE", "SEC"]:
            with self.subTest(verdict=verdict):
                result, _ = self.judge_sample(verdict.lower() + ".cpp")
                self.assertEqual(result.verdict, verdict)

    def test_ac_details(self):
        result, events = self.judge_sample("ac.cpp")
        self.assertEqual((result.score, result.passed, result.total), (100, 4, 4))
        self.assertLess(result.memory_kb, 10 * 1024, "RSS không được lẫn RSS của Python")
        self.assertEqual(events[0], {"status": "COMPILING"})
        progress = [e["progress"]["current"] for e in events if "test" in e]
        self.assertEqual(progress, [1, 2, 3, 4])

    def test_failure_skips_remaining(self):
        result, _ = self.judge_sample("wa.cpp")
        self.assertEqual([t.status for t in result.tests], ["WA", "SKIPPED", "SKIPPED", "SKIPPED"])
        self.assertEqual(result.tests[0].output.strip(), "-2")

    def test_partial_score_without_stop(self):
        src = "#include <bits/stdc++.h>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<(a>0?a+b:0);}"
        result = self.judge.judge(task_for(src, stopOnFirstFailure=False))
        self.assertEqual([t.status for t in result.tests], ["AC", "WA", "AC", "AC"])
        self.assertEqual((result.verdict, result.score), ("WA", 75))

    def test_tle_time_close_to_limit(self):
        result, _ = self.judge_sample("tle.cpp")
        self.assertGreaterEqual(result.tests[0].time_ms, 1000)
        self.assertLess(result.tests[0].time_ms, 1500)

    def test_rte_reports_signal(self):
        result, _ = self.judge_sample("rte.cpp")
        self.assertEqual(result.tests[0].signal, "SIGFPE")

    def test_nonzero_exit_is_rte(self):
        result = self.judge.judge(task_for("int main(){ return 3; }"))
        self.assertEqual((result.verdict, result.tests[0].exit_code), ("RTE", 3))

    def test_static_array_counts_only_touched_memory(self):
        """Như go-judge (cgroup): chỉ tính bộ nhớ thực dùng, không tính kích thước khai báo."""
        untouched = "#include <bits/stdc++.h>\nint a[500000000];\nint main(){long long x,y;std::cin>>x>>y;a[1]=1;std::cout<<x+y-1+a[1];}"
        self.assertEqual(self.judge.judge(task_for(untouched)).verdict, "AC")
        touched = (
            "#include <bits/stdc++.h>\nint a[100000000];\nint main(){ memset(a, 1, sizeof a);"
            " long long s=0; for(int i=0;i<100000000;i+=4096) s+=a[i]; std::cout<<s; }"
        )
        result = self.judge.judge(task_for(touched))
        self.assertEqual(result.verdict, "MLE")
        self.assertEqual(result.tests[0].detail, "Memory Limit Exceeded")

    def test_threads_are_allowed(self):
        """RLIMIT_AS + stack = ML từng làm pthread_create thất bại (RTE) – go-judge cho AC."""
        src = (
            "#include <bits/stdc++.h>\nint main(){ long long a,b; std::cin>>a>>b; long long r[2];"
            " std::thread t1([&]{r[0]=a;}), t2([&]{r[1]=b;}); t1.join(); t2.join(); std::cout<<r[0]+r[1]; }"
        )
        self.assertEqual(self.judge.judge(task_for(src)).verdict, "AC")

    def test_memory_over_limit_is_mle(self):
        src = (
            "#include <bits/stdc++.h>\nint main(){ std::vector<char> v(300<<20, 1);"
            " long long s=0; for(char c: v) s+=c; std::cout<<s; }"
        )
        result = self.judge.judge(task_for(src))
        self.assertEqual(result.verdict, "MLE")

    def test_memory_under_limit_is_measured(self):
        src = (
            "#include <bits/stdc++.h>\nint main(){ long long a,b; std::cin>>a>>b; std::vector<char> v(100<<20, 1);"
            " long long s=0; for(char c: v) s+=c; std::cout<<a+b+s-(long long)v.size(); }"
        )
        result = self.judge.judge(task_for(src))
        self.assertEqual(result.verdict, "AC")
        self.assertGreater(result.memory_kb, 100 * 1024)

    def test_cannot_open_files(self):
        src = (
            "#include <bits/stdc++.h>\nint main(){ long long a,b; std::cin>>a>>b;"
            " FILE* f = fopen(\"/etc/hostname\", \"r\"); std::cout << (f ? 0 : a+b); }"
        )
        self.assertEqual(self.judge.judge(task_for(src)).verdict, "AC")

    def test_compile_error_log_has_relative_path(self):
        result, _ = self.judge_sample("ce.cpp")
        self.assertIn("solution.cpp:", result.compile_log)
        self.assertNotIn("/tmp/", result.compile_log)


class ScannerTest(unittest.TestCase):
    def assertBlocked(self, code):
        self.assertIsNotNone(scanner.scan(code), code)

    def assertAllowed(self, code):
        self.assertIsNone(scanner.scan(code), code)

    def test_blocks(self):
        self.assertBlocked("#include <windows.h>\nint main(){}")
        self.assertBlocked("#include <sys/socket.h>\nint main(){}")
        self.assertBlocked('#include "/etc/passwd"\nint main(){}')
        self.assertBlocked("#include </etc/passwd>\nint main(){}")
        self.assertBlocked('int main(){ system("ls"); }')
        self.assertBlocked('int main(){ sys\\\ntem("ls"); }')
        self.assertBlocked("int main(){ fork(); }")
        self.assertBlocked("int main(){ kill(-1, 9); }")
        self.assertBlocked('extern "C" int socket(int,int,int);\nint main(){}')
        self.assertBlocked('int main(){ remove("a.txt"); }')
        self.assertBlocked('#include <bits/stdc++.h>\nint main(){ std::filesystem::remove_all("/"); }')
        self.assertBlocked('int main(){ auto f = system; f("ls"); }')

    def test_allows(self):
        self.assertAllowed(
            "#include <bits/stdc++.h>\nusing namespace std;\n"
            '// system("rm -rf /") chỉ là comment\n'
            "/* fork() */\n"
            'int main(){ string s = "system(fork())"; vector<int> v{3,1,2};'
            " v.erase(remove(v.begin(), v.end(), 1), v.end());"
            " auto t = chrono::system_clock::now(); (void)t; cout << s; }"
        )
        self.assertAllowed('int main(){ auto s = R"x(system("a"))x"; }')

    def test_violation_line_number(self):
        v = scanner.scan("#include <iostream>\n\nint main(){\n  system(\"x\");\n}")
        self.assertEqual(v.line, 4)


class CheckerTest(unittest.TestCase):
    def test_lines(self):
        self.assertTrue(compare_lines(b"8  \r\n\n\n", "8"))
        self.assertTrue(compare_lines(b"1 2\n3\n", "1 2\n3"))
        self.assertFalse(compare_lines(b"1  2", "1 2"))
        self.assertFalse(compare_lines(b"", "0"))

    def test_tokens(self):
        self.assertTrue(compare_tokens(b"1\n2  3", "1 2 3"))
        self.assertFalse(compare_tokens(b"1 2", "1 2 3"))


if __name__ == "__main__":
    unittest.main()
