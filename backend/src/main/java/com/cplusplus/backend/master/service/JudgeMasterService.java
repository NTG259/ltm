package com.cplusplus.backend.master.service;

import com.cplusplus.backend.domain.contest.Contest;
import com.cplusplus.backend.domain.problem.Problem;
import com.cplusplus.backend.domain.problem.TestCase;
import com.cplusplus.backend.domain.submission.*;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.worker.JudgeWorker;
import com.cplusplus.backend.domain.worker.LogLevel;
import com.cplusplus.backend.domain.worker.SystemLog;
import com.cplusplus.backend.domain.worker.WorkerStatus;
import com.cplusplus.backend.dto.DtoMapper;
import com.cplusplus.backend.master.protocol.MasterProtocol;
import com.cplusplus.backend.master.tcp.WorkerSession;
import com.cplusplus.backend.master.ws.MasterWebSocketServer;
import com.cplusplus.backend.repository.ContestRepository;
import com.cplusplus.backend.repository.JudgeWorkerRepository;
import com.cplusplus.backend.repository.ProblemRepository;
import com.cplusplus.backend.repository.SubmissionRepository;
import com.cplusplus.backend.repository.SystemLogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class JudgeMasterService {

    private static final Logger log = LoggerFactory.getLogger(JudgeMasterService.class);

    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;
    private final JudgeWorkerRepository judgeWorkerRepository;
    private final SystemLogRepository systemLogRepository;
    private final ContestRepository contestRepository;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    @Value("${master.tcp.port:9000}")
    private int tcpPort;

    @Value("${master.ws.port:8001}")
    private int wsPort;

    private MasterWebSocketServer wsServer;
    private ServerSocket tcpServerSocket;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    private final Map<String, WorkerSession> activeWorkers = new ConcurrentHashMap<>();
    private final Queue<Long> submissionQueue = new ConcurrentLinkedQueue<>();
    private final Map<Long, CompletableFuture<Map<String, Object>>> pendingRunTests = new ConcurrentHashMap<>();
    private final AtomicLong nextRunTestId = new AtomicLong(-1000);
    private volatile boolean running = true;

    public JudgeMasterService(
            SubmissionRepository submissionRepository,
            ProblemRepository problemRepository,
            JudgeWorkerRepository judgeWorkerRepository,
            SystemLogRepository systemLogRepository,
            ContestRepository contestRepository,
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper) {
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
        this.judgeWorkerRepository = judgeWorkerRepository;
        this.systemLogRepository = systemLogRepository;
        this.contestRepository = contestRepository;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void start() {
        log.info("Khởi động JudgeMasterService...");

        // 1. Đánh dấu tất cả worker cũ trong DB là DEAD
        transactionTemplate.executeWithoutResult(status -> {
            judgeWorkerRepository.markAllDead(Instant.now(), WorkerStatus.DEAD);
        });

        // 2. Khởi động WebSocket Server :8001
        try {
            wsServer = new MasterWebSocketServer(wsPort);
            wsServer.start();
            log.info("WebSocket server đã khởi động trên cổng {}", wsPort);
        } catch (Exception e) {
            log.error("Không thể khởi động WebSocket server trên cổng {}: {}", wsPort, e.getMessage());
        }

        // 3. Khởi động TCP Server :9000
        executor.submit(this::listenTcpWorkers);

        // 4. Khôi phục hàng đợi từ Database
        transactionTemplate.executeWithoutResult(status -> {
            List<Long> pendingIds = submissionRepository.findPendingIdsInQueueOrder();
            if (!pendingIds.isEmpty()) {
                submissionQueue.addAll(pendingIds);
                log.info("Đã khôi phục {} bài nộp chờ chấm vào hàng đợi", pendingIds.size());
            }
        });

        // 5. Khởi động Heartbeat scheduler (mỗi 5 giây)
        scheduler.scheduleAtFixedRate(this::checkHeartbeats, 5, 5, TimeUnit.SECONDS);

        // Thử giao việc nếu có bài trong hàng đợi
        scheduler.schedule(this::dispatchNext, 2, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void stop() {
        running = false;
        log.info("Đang dừng JudgeMasterService...");
        try {
            if (tcpServerSocket != null && !tcpServerSocket.isClosed()) {
                tcpServerSocket.close();
            }
        } catch (IOException ignored) {}

        for (WorkerSession session : activeWorkers.values()) {
            session.close();
        }
        activeWorkers.clear();

        if (wsServer != null) {
            try {
                wsServer.stop(1000);
            } catch (InterruptedException ignored) {}
        }

        executor.shutdownNow();
        scheduler.shutdownNow();

        transactionTemplate.executeWithoutResult(status -> {
            judgeWorkerRepository.markAllDead(Instant.now(), WorkerStatus.DEAD);
        });
    }

    // -------------------------------------------------- TCP Worker Loop
    private void listenTcpWorkers() {
        try {
            tcpServerSocket = new ServerSocket(tcpPort);
            tcpServerSocket.setReuseAddress(true);
            log.info("TCP Worker Server đã lắng nghe trên cổng {}", tcpPort);

            while (running && !tcpServerSocket.isClosed()) {
                Socket socket = tcpServerSocket.accept();
                socket.setTcpNoDelay(true);
                socket.setKeepAlive(true);
                executor.submit(() -> handleWorkerConnection(socket));
            }
        } catch (IOException e) {
            if (running) {
                log.error("Lỗi TCP Worker Server: {}", e.getMessage());
            }
        }
    }

    private void handleWorkerConnection(Socket socket) {
        WorkerSession session = null;
        try {
            session = new WorkerSession(socket);
            log.info("Nhận kết nối TCP mới từ {}", session.getAddress());

            while (running && !session.isClosed()) {
                MasterProtocol.Message msg = session.readMessage();
                handleWorkerMessage(session, msg.opcode(), msg.jsonPayload());
            }
        } catch (IOException e) {
            log.info("Worker kết nối đóng ({})", e.getMessage());
        } finally {
            if (session != null) {
                onWorkerDisconnected(session);
            }
        }
    }

    private void handleWorkerMessage(WorkerSession session, int opcode, String payloadJson) {
        try {
            Map<String, Object> payload = objectMapper.readValue(payloadJson, new TypeReference<>() {});
            switch (opcode) {
                case MasterProtocol.OP_WORKER_REGISTER -> onWorkerRegister(session, payload, payloadJson);
                case MasterProtocol.OP_HEARTBEAT -> onWorkerHeartbeat(session, payload);
                case MasterProtocol.OP_TASK_STATUS -> onWorkerTaskStatus(session, payload);
                case MasterProtocol.OP_TASK_RESULT -> onWorkerTaskResult(session, payload);
                default -> log.warn("Bỏ qua opcode không xác định: 0x{:02X}", opcode);
            }
        } catch (Exception e) {
            log.error("Lỗi xử lý bản tin từ worker {}: {}", session.getId(), e.getMessage(), e);
        }
    }

    private void onWorkerRegister(WorkerSession session, Map<String, Object> payload, String rawJson) {
        String workerId = String.valueOf(payload.getOrDefault("workerId", "unknown"));
        session.setId(workerId);
        session.setCompiler(String.valueOf(payload.getOrDefault("compiler", "g++")));
        session.setSandbox(String.valueOf(payload.getOrDefault("sandbox", "native")));
        session.setVersion(String.valueOf(payload.getOrDefault("version", "1.0.0")));
        session.setHostname(String.valueOf(payload.getOrDefault("hostname", "localhost")));
        session.setLastHeartbeat(System.currentTimeMillis());

        activeWorkers.put(workerId, session);
        log.info("Worker [{}] đã đăng ký thành công (Compiler: {}, Sandbox: {})",
                workerId, session.getCompiler(), session.getSandbox());

        // Gửi xác nhận lại cho Worker
        try {
            Map<String, Object> ack = Map.of("accepted", true, "workerId", workerId, "master", "CodeJudge-Master");
            session.send(MasterProtocol.OP_WORKER_REGISTER, objectMapper.writeValueAsString(ack));
        } catch (IOException e) {
            log.error("Không gửi được xác nhận đăng ký cho worker {}: {}", workerId, e.getMessage());
        }

        // Lưu vào DB
        transactionTemplate.executeWithoutResult(status -> {
            Instant now = Instant.now();
            JudgeWorker worker = judgeWorkerRepository.findById(workerId)
                    .orElseGet(() -> new JudgeWorker(workerId, now));
            worker.onRegister(session.getAddress(), session.getHostname(), session.getVersion(),
                    session.getCompiler(), session.getSandbox(), rawJson, now);
            judgeWorkerRepository.save(worker);

            addLog(LogLevel.INFO, "Worker " + workerId + " đã kết nối (" + session.getAddress() + ")", worker, null);
        });

        broadcastWorkerUpdate();
        dispatchNext();
    }

    private void onWorkerHeartbeat(WorkerSession session, Map<String, Object> payload) {
        session.setLastHeartbeat(System.currentTimeMillis());
        Object tsObj = payload.get("ts");
        if (tsObj instanceof Number num) {
            long rtt = System.currentTimeMillis() - num.longValue();
            session.setLatencyMs(Math.max(1, rtt));
        }
        if (payload.get("completed") instanceof Number comp) {
            session.setCompleted(comp.intValue());
        }
        broadcastWorkerUpdate();
    }

    private void onWorkerTaskStatus(WorkerSession session, Map<String, Object> payload) {
        Long sid = getLong(payload.get("submissionId"));
        String statusStr = String.valueOf(payload.get("status"));
        if (sid == null || sid < 0) return;

        transactionTemplate.executeWithoutResult(status -> {
            submissionRepository.findDetailed(sid).ifPresent(sub -> {
                Instant now = Instant.now();
                if ("COMPILING".equalsIgnoreCase(statusStr)) {
                    sub.updateStatus(SubmissionStatus.COMPILING, now);
                } else if ("TESTING".equalsIgnoreCase(statusStr)) {
                    sub.updateStatus(SubmissionStatus.TESTING, now);
                }
                submissionRepository.save(sub);
                broadcastSubmissionUpdate(sub);
            });
        });
    }

    @SuppressWarnings("unchecked")
    private void onWorkerTaskResult(WorkerSession session, Map<String, Object> payload) {
        Long sid = getLong(payload.get("submissionId"));
        if (sid == null) return;

        if (sid < 0) {
            CompletableFuture<Map<String, Object>> future = pendingRunTests.remove(sid);
            if (future != null) {
                session.setBusy(false);
                session.setCurrentTask(null);
                session.setCompleted(session.getCompleted() + 1);
                future.complete(payload);
                broadcastWorkerUpdate();
                dispatchNext();
                return;
            }
        }

        session.setBusy(false);
        session.setCurrentTask(null);
        session.setCompleted(session.getCompleted() + 1);

        transactionTemplate.executeWithoutResult(status -> {
            submissionRepository.findDetailed(sid).ifPresent(sub -> {
                Instant now = Instant.now();
                String verdictStr = String.valueOf(payload.getOrDefault("verdict", "RTE"));
                Verdict verdict;
                try {
                    verdict = Verdict.valueOf(verdictStr.toUpperCase());
                } catch (Exception e) {
                    verdict = Verdict.RTE;
                }

                int score = getInt(payload.get("score"), 0);
                Integer timeMs = getInteger(payload.get("timeMs"));
                Integer memoryKb = getInteger(payload.get("memoryKb"));
                int passed = getInt(payload.get("passed"), 0);
                int total = getInt(payload.get("total"), 0);
                String compileLog = (String) payload.get("compileLog");
                String securityMsg = (String) payload.get("securityMessage");

                List<SubmissionTestResult.Data> testDataList = new ArrayList<>();
                Object rawTests = payload.get("tests");
                if (rawTests instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> tm) {
                            short tIndex = (short) getInt(tm.get("index"), 1);
                            Object statObj = tm.get("status");
                            String tStatStr = statObj != null ? statObj.toString() : "SKIPPED";
                            TestStatus tStat;
                            try {
                                tStat = TestStatus.valueOf(tStatStr);
                            } catch (Exception ex) {
                                tStat = TestStatus.SKIPPED;
                            }
                            testDataList.add(new SubmissionTestResult.Data(
                                    tIndex,
                                    tStat,
                                    getInteger(tm.get("timeMs")),
                                    getInteger(tm.get("memoryKb")),
                                    (String) tm.get("output"),
                                    (String) tm.get("stderr"),
                                    getInteger(tm.get("exitCode")),
                                    (String) tm.get("signal"),
                                    (String) tm.get("detail")
                            ));
                        }
                    }
                }

                Submission.Outcome outcome = new Submission.Outcome(
                        verdict, score, timeMs, memoryKb, passed, total,
                        compileLog, securityMsg, testDataList
                );

                sub.finish(outcome, now);
                submissionRepository.save(sub);

                if (session.getId() != null) {
                    judgeWorkerRepository.findById(session.getId()).ifPresent(w -> {
                        w.onTaskFinished();
                        judgeWorkerRepository.save(w);
                    });
                }

                addLog(LogLevel.SUCCESS, "Bài #" + sid + " đã chấm xong: " + verdict + " (" + score + "/100)",
                        sub.getWorker(), sub);
                broadcastSubmissionUpdate(sub);

                if (sub.getContest() != null) {
                    broadcastContestUpdate(sub.getContest().getId());
                }
            });
        });

        broadcastWorkerUpdate();
        dispatchNext();
    }

    private void onWorkerDisconnected(WorkerSession session) {
        String workerId = session.getId();
        if (workerId == null) return;

        session.close();
        activeWorkers.remove(workerId);
        log.warn("Worker [{}] đã ngắt kết nối", workerId);

        Long runningSubId = session.getCurrentTask();

        transactionTemplate.executeWithoutResult(status -> {
            Instant now = Instant.now();
            judgeWorkerRepository.findById(workerId).ifPresent(w -> {
                w.onDisconnect(now);
                judgeWorkerRepository.save(w);
            });

            addLog(LogLevel.WARNING, "Worker " + workerId + " đã ngắt kết nối", null, null);

            // Failover: nếu worker đang chấm một bài, đưa bài đó về hàng đợi
            if (runningSubId != null) {
                if (runningSubId < 0) {
                    CompletableFuture<Map<String, Object>> future = pendingRunTests.remove(runningSubId);
                    if (future != null) {
                        future.completeExceptionally(new RuntimeException("Worker đã mất kết nối trong khi chạy thử"));
                    }
                } else {
                    submissionRepository.findDetailed(runningSubId).ifPresent(sub -> {
                        boolean canRequeue = sub.requeue(SubmissionEventType.REQUEUED,
                                "Mất kết nối tới " + workerId + " khi đang chấm", now);
                        submissionRepository.save(sub);
                        if (canRequeue) {
                            submissionQueue.add(runningSubId);
                            log.info("Bài #{} đã được đưa trở lại hàng đợi (Failover)", runningSubId);
                        } else {
                            log.warn("Bài #{} đã vượt quá số lần thử tối đa, đánh dấu FAILED", runningSubId);
                        }
                        broadcastSubmissionUpdate(sub);
                    });
                }
            }
        });

        broadcastWorkerUpdate();
        dispatchNext();
    }

    // -------------------------------------------------- Dispatcher
    public synchronized void dispatchNext() {
        if (submissionQueue.isEmpty()) return;

        // Tìm worker đang rảnh
        WorkerSession idleWorker = null;
        for (WorkerSession ws : activeWorkers.values()) {
            if (!ws.isBusy() && !ws.isClosed()) {
                idleWorker = ws;
                break;
            }
        }

        if (idleWorker == null) {
            log.debug("Chưa có worker rảnh để giao việc (Hàng đợi: {})", submissionQueue.size());
            return;
        }

        Long sid = submissionQueue.poll();
        if (sid == null) return;

        final WorkerSession chosenWorker = idleWorker;

        boolean assigned = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            Optional<Submission> opt = submissionRepository.findDetailed(sid);
            if (opt.isEmpty()) return false;
            Submission sub = opt.get();
            if (sub.getStatus() != SubmissionStatus.IN_QUEUE) return false;

            Optional<JudgeWorker> workerOpt = judgeWorkerRepository.findById(chosenWorker.getId());
            if (workerOpt.isEmpty()) return false;
            JudgeWorker workerEntity = workerOpt.get();

            Instant now = Instant.now();
            sub.assignTo(workerEntity, now);
            workerEntity.markBusy();
            judgeWorkerRepository.save(workerEntity);
            submissionRepository.save(sub);

            // Lấy toàn bộ đề và bộ test
            Problem problem = problemRepository.findWithTestCases(sub.getProblem().getId())
                    .orElse(sub.getProblem());

            List<Map<String, Object>> testsList = new ArrayList<>();
            if (problem.getTestCases() != null) {
                for (TestCase tc : problem.getTestCases()) {
                    testsList.add(Map.of(
                            "index", (int) tc.getPosition(),
                            "input", tc.getInput(),
                            "output", tc.getExpectedOutput()
                    ));
                }
            }

            Map<String, Object> taskPayload = new LinkedHashMap<>();
            taskPayload.put("submissionId", sub.getId());
            taskPayload.put("sourceCode", sub.getSourceCode());
            taskPayload.put("timeLimitMs", sub.getTimeLimitMs());
            taskPayload.put("memoryLimitMb", sub.getMemoryLimitMb());
            taskPayload.put("language", sub.getLanguage().code());
            taskPayload.put("checker", "lines");
            taskPayload.put("stopOnFirstFailure", false);
            taskPayload.put("attempt", (int) sub.getAttempts());
            taskPayload.put("tests", testsList);

            try {
                chosenWorker.send(MasterProtocol.OP_TASK_ASSIGN, objectMapper.writeValueAsString(taskPayload));
                chosenWorker.setBusy(true);
                chosenWorker.setCurrentTask(sid);
                log.info("Đã giao bài #{} cho Worker [{}]", sid, chosenWorker.getId());

                broadcastSubmissionUpdate(sub);
                return true;
            } catch (IOException e) {
                log.error("Lỗi khi gửi OP_TASK_ASSIGN cho worker {}: {}", chosenWorker.getId(), e.getMessage());
                status.setRollbackOnly();
                return false;
            }
        }));

        if (!assigned) {
            // Đưa lại vào hàng đợi nếu lỗi
            submissionQueue.add(sid);
        } else {
            broadcastWorkerUpdate();
            // Thử giao tiếp nếu còn việc và còn worker
            if (!submissionQueue.isEmpty()) {
                executor.submit(this::dispatchNext);
            }
        }
    }

    // -------------------------------------------------- Public API methods
    public Submission submit(User user, Long problemId, Long contestId, String sourceCode, String language) {
        Instant now = Instant.now();
        Submission sub = transactionTemplate.execute(status -> {
            Problem problem = problemRepository.findByIdAndDeletedAtIsNull(problemId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bài tập #" + problemId));

            Contest contest = null;
            if (contestId != null) {
                contest = contestRepository.findById(contestId).orElse(null);
            }

            Submission newSub = new Submission(user, problem, contest, sourceCode, now);
            newSub = submissionRepository.save(newSub);

            addLog(LogLevel.INFO, "Nhận bài nộp mới #" + newSub.getId() + " từ thí sinh " + user.getUsername(), null, newSub);
            return newSub;
        });

        if (sub != null) {
            submissionQueue.add(sub.getId());
            broadcastSubmissionUpdate(sub);
            broadcastWorkerUpdate();
            dispatchNext();
        }
        return sub;
    }

    public Map<String, Object> runCustomTest(Long problemId, String sourceCode, String input, String expectedOutput) {
        if (activeWorkers.isEmpty()) {
            throw new IllegalStateException("Không có máy chấm Worker nào đang online");
        }

        WorkerSession target = null;
        for (WorkerSession w : activeWorkers.values()) {
            if (!w.isClosed() && !w.isBusy()) {
                target = w;
                break;
            }
        }
        if (target == null) {
            target = activeWorkers.values().stream().filter(w -> !w.isClosed()).findFirst().orElse(null);
        }
        if (target == null) {
            throw new IllegalStateException("Không có máy chấm Worker nào sẵn sàng");
        }

        int timeLimitMs = 1000;
        int memoryLimitMb = 256;
        if (problemId != null) {
            var probOpt = problemRepository.findById(problemId);
            if (probOpt.isPresent()) {
                timeLimitMs = probOpt.get().getTimeLimitMs();
                memoryLimitMb = probOpt.get().getMemoryLimitMb();
            }
        }

        long runId = nextRunTestId.decrementAndGet();
        CompletableFuture<Map<String, Object>> future = new CompletableFuture<>();
        pendingRunTests.put(runId, future);

        Map<String, Object> taskPayload = new LinkedHashMap<>();
        taskPayload.put("submissionId", runId);
        taskPayload.put("sourceCode", sourceCode);
        taskPayload.put("timeLimitMs", timeLimitMs > 0 ? timeLimitMs : 1000);
        taskPayload.put("memoryLimitMb", memoryLimitMb > 0 ? memoryLimitMb : 256);
        taskPayload.put("language", "cpp17");
        taskPayload.put("stopOnFirstFailure", true);

        Map<String, Object> testMap = new LinkedHashMap<>();
        testMap.put("index", 1);
        testMap.put("input", input != null ? input : "");
        testMap.put("output", expectedOutput != null ? expectedOutput : "");
        taskPayload.put("tests", List.of(testMap));

        try {
            target.setBusy(true);
            target.setCurrentTask(runId);
            target.send(MasterProtocol.OP_TASK_ASSIGN, objectMapper.writeValueAsString(taskPayload));
            broadcastWorkerUpdate();

            Map<String, Object> resultPayload = future.get(15, TimeUnit.SECONDS);

            boolean hasExpected = expectedOutput != null && !expectedOutput.trim().isEmpty();
            String rawVerdict = String.valueOf(resultPayload.getOrDefault("verdict", "RTE"));
            String verdict = rawVerdict;
            // Nếu người dùng không nhập expected output (chỉ nhập input để xem output):
            // Nếu chương trình chạy thoát bình thường (worker trả WA vì so sánh với chuỗi rỗng), ta coi là AC/thành công.
            if (!hasExpected && "WA".equalsIgnoreCase(rawVerdict)) {
                verdict = "AC";
            }

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("verdict", verdict);
            res.put("hasExpected", hasExpected);
            res.put("timeMs", resultPayload.getOrDefault("timeMs", 0));
            res.put("memoryKb", resultPayload.getOrDefault("memoryKb", 0));
            res.put("compileLog", resultPayload.get("compileLog"));
            res.put("securityMessage", resultPayload.get("securityMessage"));

            String stdout = "";
            String stderr = "";
            Object rawTests = resultPayload.get("tests");
            if (rawTests instanceof List<?> list && !list.isEmpty()) {
                Object first = list.get(0);
                if (first instanceof Map<?, ?> tm) {
                    stdout = (String) tm.get("output");
                    stderr = (String) tm.get("stderr");
                }
            }
            res.put("output", stdout != null ? stdout : "");
            res.put("stderr", stderr != null ? stderr : "");
            res.put("expectedOutput", expectedOutput != null ? expectedOutput : "");
            return res;
        } catch (TimeoutException e) {
            pendingRunTests.remove(runId);
            target.setBusy(false);
            target.setCurrentTask(null);
            throw new RuntimeException("Chạy thử vượt quá thời gian phản hồi (15s)");
        } catch (Exception e) {
            pendingRunTests.remove(runId);
            target.setBusy(false);
            target.setCurrentTask(null);
            throw new RuntimeException("Lỗi khi chạy thử: " + e.getMessage(), e);
        }
    }

    public List<Long> getQueue() {
        return new ArrayList<>(submissionQueue);
    }

    public List<Map<String, Object>> getWorkerSummaries() {
        List<Map<String, Object>> list = new ArrayList<>();
        List<JudgeWorker> dbWorkers = judgeWorkerRepository.findAllByOrderById();

        for (JudgeWorker jw : dbWorkers) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", jw.getId());
            map.put("address", jw.getAddress() != null ? jw.getAddress() : "127.0.0.1:9000");

            WorkerSession session = activeWorkers.get(jw.getId());
            if (session != null && !session.isClosed()) {
                map.put("status", session.isBusy() ? "BUSY" : "IDLE");
                map.put("currentTask", session.getCurrentTask());
                map.put("completed", session.getCompleted());
                map.put("connectedAt", session.getConnectedAt());
                map.put("lastHeartbeat", session.getLastHeartbeat());
                map.put("latencyMs", session.getLatencyMs());
            } else {
                map.put("status", "DEAD");
                map.put("currentTask", null);
                map.put("completed", jw.getCompletedCount());
                map.put("connectedAt", jw.getConnectedAt() != null ? jw.getConnectedAt().toEpochMilli() : null);
                map.put("lastHeartbeat", jw.getLastHeartbeatAt() != null ? jw.getLastHeartbeatAt().toEpochMilli() : null);
                map.put("latencyMs", null);
            }
            list.add(map);
        }
        return list;
    }

    public void disconnectWorker(String workerId) {
        WorkerSession session = activeWorkers.get(workerId);
        if (session != null) {
            session.close();
            onWorkerDisconnected(session);
        }
    }

    private void checkHeartbeats() {
        long now = System.currentTimeMillis();
        for (WorkerSession session : activeWorkers.values()) {
            if (session.isClosed()) continue;

            // Nếu quá 15s không phản hồi -> coi là DEAD
            if (now - session.getLastHeartbeat() > 15_000) {
                log.warn("Worker [{}] mất phản hồi quá 15s, ngắt kết nối", session.getId());
                session.close();
                onWorkerDisconnected(session);
                continue;
            }

            // Gửi PING
            try {
                Map<String, Object> ping = Map.of("type", "PING", "ts", now);
                session.send(MasterProtocol.OP_HEARTBEAT, objectMapper.writeValueAsString(ping));
            } catch (IOException e) {
                log.warn("Lỗi gửi PING tới {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    // -------------------------------------------------- WebSocket Broadcasting
    public void broadcastSubmissionUpdate(Submission submission) {
        if (wsServer == null) return;
        try {
            Map<String, Object> msg = Map.of(
                    "type", "SUBMISSION_UPDATE",
                    "submission", DtoMapper.toSubmissionMap(submission)
            );
            wsServer.broadcastText(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.warn("Lỗi broadcast SUBMISSION_UPDATE: {}", e.getMessage());
        }
    }

    public void broadcastWorkerUpdate() {
        if (wsServer == null) return;
        try {
            Map<String, Object> msg = Map.of(
                    "type", "WORKER_UPDATE",
                    "workers", getWorkerSummaries(),
                    "queue", getQueue()
            );
            wsServer.broadcastText(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.warn("Lỗi broadcast WORKER_UPDATE: {}", e.getMessage());
        }
    }

    public void broadcastContestUpdate(Long contestId) {
        if (wsServer == null) return;
        try {
            Map<String, Object> msg = Map.of(
                    "type", "CONTEST_UPDATE",
                    "contestId", contestId
            );
            wsServer.broadcastText(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.warn("Lỗi broadcast CONTEST_UPDATE: {}", e.getMessage());
        }
    }

    public void addLog(LogLevel level, String message, JudgeWorker worker, Submission sub) {
        try {
            Instant now = Instant.now();
            SystemLog logEntry = new SystemLog(level, message, now);
            if (worker != null || sub != null) {
                logEntry.about(worker, sub);
            }
            systemLogRepository.save(logEntry);

            if (wsServer != null) {
                Map<String, Object> entry = Map.of(
                        "id", logEntry.getId() != null ? logEntry.getId() : System.currentTimeMillis(),
                        "time", now.toEpochMilli(),
                        "level", level.code(),
                        "message", message
                );
                Map<String, Object> msg = Map.of("type", "LOG", "entry", entry);
                wsServer.broadcastText(objectMapper.writeValueAsString(msg));
            }
        } catch (Exception e) {
            log.warn("Lỗi ghi log: {}", e.getMessage());
        }
    }

    private Long getLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s) {
            try { return Long.parseLong(s); } catch (Exception ignored) {}
        }
        return null;
    }

    private int getInt(Object o, int def) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }

    private Integer getInteger(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return null;
    }
}
