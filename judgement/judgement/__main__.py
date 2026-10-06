"""Điểm vào dòng lệnh.

    python -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000
    python -m judgement judge samples/ac.cpp --problem samples/aplusb.json
    python -m judgement scan samples/sec.cpp
"""

from __future__ import annotations

import argparse
import json
import logging
import socket
import sys

from . import __version__, scanner
from .judge import Judge, JudgeConfig, Task


def _add_judge_options(p: argparse.ArgumentParser) -> None:
    p.add_argument("--compiler", default="g++", help="trình biên dịch C++ (mặc định g++)")
    p.add_argument("--no-static", action="store_true", help="không link tĩnh (nới lỏng giới hạn mở file)")
    p.add_argument("--work-dir", default=None, help="thư mục chứa file tạm khi chấm")
    p.add_argument("--keep-files", action="store_true", help="giữ lại thư mục chấm để gỡ lỗi")


def _judge_config(args: argparse.Namespace) -> JudgeConfig:
    return JudgeConfig(
        compiler=args.compiler,
        static=False if args.no_static else None,
        work_root=args.work_dir,
        keep_files=args.keep_files,
    )


def cmd_worker(args: argparse.Namespace) -> int:
    from .worker import Worker

    worker = Worker(
        worker_id=args.id or f"worker-{socket.gethostname()}",
        master_host=args.master_host,
        master_port=args.master_port,
        judge=Judge(_judge_config(args)),
        master_timeout=args.master_timeout,
    )
    return worker.run_forever()


def cmd_judge(args: argparse.Namespace) -> int:
    with open(args.problem, encoding="utf-8") as f:
        problem = json.load(f)
    with open(args.source, encoding="utf-8") as f:
        source = f.read()
    payload = {**problem, "submissionId": args.source, "sourceCode": source}
    if args.time_limit:
        payload["timeLimitMs"] = args.time_limit
    if args.memory_limit:
        payload["memoryLimitMb"] = args.memory_limit

    def on_status(msg):
        if not args.quiet:
            print(json.dumps(msg, ensure_ascii=False), file=sys.stderr)

    result = Judge(_judge_config(args)).judge(Task.from_payload(payload), on_status)
    print(json.dumps(result.to_json(), ensure_ascii=False, indent=2))
    return 0 if result.verdict == "AC" else 1


def cmd_scan(args: argparse.Namespace) -> int:
    with open(args.source, encoding="utf-8") as f:
        violation = scanner.scan(f.read())
    print(violation or "OK")
    return 1 if violation else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="judgement", description="Judge Worker – chấm bài C++ (" + __version__ + ")")
    parser.add_argument("-v", "--verbose", action="store_true", help="in log DEBUG")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("worker", help="kết nối tới Master và nhận bài chấm")
    p.add_argument("--id", help="mã định danh Worker (mặc định worker-<hostname>)")
    p.add_argument("--master-host", default="127.0.0.1")
    p.add_argument("--master-port", type=int, default=9000)
    p.add_argument("--master-timeout", type=float, default=20.0,
                   help="số giây không nhận được gì từ Master thì coi như mất kết nối (Master PING mỗi 5s)")
    _add_judge_options(p)
    p.set_defaults(func=cmd_worker)

    p = sub.add_parser("judge", help="chấm một file .cpp tại chỗ, không cần Master")
    p.add_argument("source")
    p.add_argument("--problem", required=True, help="file JSON đề bài: {timeLimitMs, memoryLimitMb, tests:[{input,output}]}")
    p.add_argument("--time-limit", type=int, help="ghi đè giới hạn thời gian (ms)")
    p.add_argument("--memory-limit", type=int, help="ghi đè giới hạn bộ nhớ (MB)")
    p.add_argument("-q", "--quiet", action="store_true", help="không in các bản tin trạng thái")
    _add_judge_options(p)
    p.set_defaults(func=cmd_judge)

    p = sub.add_parser("scan", help="chỉ quét bảo mật tĩnh một file .cpp")
    p.add_argument("source")
    p.set_defaults(func=cmd_scan)

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
