/*
 * judgement launcher – chạy một chương trình với giới hạn tài nguyên và đo chính xác.
 *
 * Python không thể đo RSS của tiến trình con chính xác: ru_maxrss được giữ qua
 * execve nên luôn chứa RSS của trình thông dịch đã fork ra nó (~12 MB). Launcher
 * nhỏ này đóng vai "runner" của go-sandbox: fork -> setrlimit -> execvp ở tiến
 * trình con, còn tiến trình cha theo dõi thời gian thực + CPU và đo bằng wait4.
 *
 * Cách dùng:
 *   launcher RESULT_FD CPU_MS CLOCK_MS AS_BYTES STACK_BYTES FSIZE_BYTES NOFILE -- prog [args...]
 *
 * Kết quả ghi ra RESULT_FD một dòng:
 *   signaled exit_code signal cpu_us wall_us maxrss_kb killed_for_time exec_errno
 *
 * Viết bằng C thuần nhưng biên dịch được cả bằng g++.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/prctl.h>
#endif

static long long now_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (long long)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}

/* utime + stime (ms) của tiến trình đang chạy, đọc từ /proc/<pid>/stat. */
static long long cpu_ms_of(pid_t pid, long clk_tck) {
    char path[64], buf[1024];
    snprintf(path, sizeof path, "/proc/%d/stat", (int)pid);
    FILE *f = fopen(path, "r");
    if (!f) return 0;
    size_t n = fread(buf, 1, sizeof buf - 1, f);
    fclose(f);
    buf[n] = '\0';
    char *p = strrchr(buf, ')'); /* comm có thể chứa dấu cách */
    if (!p) return 0;
    unsigned long ut = 0, st = 0;
    /* trường 3..13 bỏ qua, 14 = utime, 15 = stime */
    if (sscanf(p + 2, "%*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %lu %lu", &ut, &st) != 2) return 0;
    return (long long)(ut + st) * 1000 / clk_tck;
}

static volatile pid_t g_child = 0;

/* Worker hủy bài: diệt cả group của tiến trình con (g++ -> cc1plus, ...) rồi thoát. */
static void on_term(int sig) {
    (void)sig;
    if (g_child > 0) {
        kill(-g_child, SIGKILL);
        kill(g_child, SIGKILL);
    }
    _exit(137);
}

static void set_limit(int resource, long long value) {
    struct rlimit r;
    r.rlim_cur = r.rlim_max = (rlim_t)value;
    setrlimit(resource, &r);
}

int main(int argc, char **argv) {
    if (argc < 10 || strcmp(argv[8], "--") != 0) {
        fprintf(stderr, "usage: %s RESULT_FD CPU_MS CLOCK_MS AS STACK FSIZE NOFILE -- prog [args...]\n", argv[0]);
        return 2;
    }
    int rfd = atoi(argv[1]);
    long long cpu_ms = atoll(argv[2]), clock_ms = atoll(argv[3]);
    long long as = atoll(argv[4]), stack = atoll(argv[5]), fsize = atoll(argv[6]), nofile = atoll(argv[7]);
    char **prog = argv + 9;
    long clk_tck = sysconf(_SC_CLK_TCK);

    fcntl(rfd, F_SETFD, FD_CLOEXEC);
    int errpipe[2];
    if (pipe(errpipe) != 0) return 3;
    fcntl(errpipe[0], F_SETFD, FD_CLOEXEC);
    fcntl(errpipe[1], F_SETFD, FD_CLOEXEC);

    sigset_t block, old;
    sigemptyset(&block);
    sigaddset(&block, SIGTERM);
    sigprocmask(SIG_BLOCK, &block, &old); /* không để SIGTERM lọt vào giữa fork và lúc ghi g_child */
    signal(SIGTERM, on_term);

    long long start = now_us();
    pid_t pid = fork();
    if (pid < 0) return 3;
    if (pid == 0) {
        signal(SIGTERM, SIG_DFL);
        sigprocmask(SIG_SETMASK, &old, NULL);
        setpgid(0, 0); /* group riêng để kill(-pid) diệt cả cây con */
#ifdef __linux__
        prctl(PR_SET_PDEATHSIG, SIGKILL); /* launcher chết -> con chết theo */
#endif
        close(errpipe[0]);
        set_limit(RLIMIT_CPU, (cpu_ms + 999) / 1000 + 1); /* dự phòng, launcher giết trước */
        if (as > 0) set_limit(RLIMIT_AS, as);
        if (stack > 0) set_limit(RLIMIT_STACK, stack);
        if (fsize > 0) set_limit(RLIMIT_FSIZE, fsize);
        if (nofile > 0) set_limit(RLIMIT_NOFILE, nofile);
        set_limit(RLIMIT_CORE, 0);
        execvp(prog[0], prog);
        int e = errno;
        if (write(errpipe[1], &e, sizeof e) < 0) { /* không còn gì để làm */ }
        _exit(127);
    }
    setpgid(pid, pid); /* gọi ở cả hai phía để tránh race với kill(-pid) */
    g_child = pid;
    sigprocmask(SIG_SETMASK, &old, NULL);
    close(errpipe[1]);

    int status = 0, killed = 0;
    struct rusage ru;
    memset(&ru, 0, sizeof ru);
    for (;;) {
        pid_t w = wait4(pid, &status, WNOHANG, &ru);
        if (w == pid) break;
        if (w < 0 && errno != EINTR) break;
        if ((now_us() - start) / 1000 > clock_ms || cpu_ms_of(pid, clk_tck) > cpu_ms) {
            killed = 1;
            kill(-pid, SIGKILL);
            kill(pid, SIGKILL);
            while (wait4(pid, &status, 0, &ru) < 0 && errno == EINTR) {}
            break;
        }
        struct timespec tick = {0, 5 * 1000000L}; /* 5 ms */
        nanosleep(&tick, NULL);
    }
    long long wall = now_us() - start;
    kill(-pid, SIGKILL); /* dọn tiến trình cháu (nếu có) */

    int exec_errno = 0;
    if (read(errpipe[0], &exec_errno, sizeof exec_errno) != (ssize_t)sizeof exec_errno) exec_errno = 0;

    long long cpu_us = (long long)ru.ru_utime.tv_sec * 1000000LL + ru.ru_utime.tv_usec
                     + (long long)ru.ru_stime.tv_sec * 1000000LL + ru.ru_stime.tv_usec;
    dprintf(rfd, "%d %d %d %lld %lld %ld %d %d\n",
            WIFSIGNALED(status) ? 1 : 0,
            WIFEXITED(status) ? WEXITSTATUS(status) : 0,
            WIFSIGNALED(status) ? WTERMSIG(status) : 0,
            cpu_us, wall, (long)ru.ru_maxrss, killed, exec_errno);
    return 0;
}
