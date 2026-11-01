package com.cplusplus.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class WorkerContainerService {

    private static final Logger log = LoggerFactory.getLogger(WorkerContainerService.class);
    private static final Pattern CONTAINER_ID = Pattern.compile("[a-f0-9]{12,64}");
    private static final String DOCKER_API_VERSION = "/v1.44";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String dockerProxyUrl;
    private final String composeProject;

    public WorkerContainerService(
            ObjectMapper objectMapper,
            @Value("${DOCKER_PROXY_URL:http://docker-proxy:2375}") String dockerProxyUrl,
            @Value("${DOCKER_COMPOSE_PROJECT:codejudge}") String composeProject) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.dockerProxyUrl = dockerProxyUrl.replaceAll("/+$", "");
        this.composeProject = composeProject;
    }

    public ActionResult apply(String rawWorkerId, Action action) {
        String workerId = validateWorkerId(rawWorkerId);
        if (action == null) {
            throw new IllegalArgumentException("Hành động máy chấm không hợp lệ");
        }

        String containerId = resolveWorkerContainer(workerId);
        String query = action == Action.START ? "" : "?t=10";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(dockerProxyUrl + DOCKER_API_VERSION + "/containers/" + containerId
                        + "/" + action.name().toLowerCase(Locale.ROOT) + query))
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() != 204 && response.statusCode() != 304) {
            log.warn("Docker từ chối {} máy chấm {} với HTTP {}", action, workerId, response.statusCode());
            throw new IllegalStateException("Không thể " + action.label + " máy chấm lúc này");
        }

        log.info("Admin đã yêu cầu {} container máy chấm {}", action, workerId);
        return new ActionResult(workerId, action, "ACCEPTED");
    }

    private String resolveWorkerContainer(String workerId) {
        try {
            String filters = objectMapper.writeValueAsString(Map.of("label", List.of(
                    "com.docker.compose.project=" + composeProject,
                    "com.docker.compose.service=worker"
            )));
            String encodedFilters = URLEncoder.encode(filters, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(dockerProxyUrl + DOCKER_API_VERSION
                            + "/containers/json?all=true&filters=" + encodedFilters))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = send(request);
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Không thể đọc danh sách container máy chấm");
            }

            JsonNode containers = objectMapper.readTree(response.body());
            if (!containers.isArray()) {
                throw new IllegalStateException("Docker trả về danh sách container không hợp lệ");
            }

            List<String> matches = new ArrayList<>();
            for (JsonNode container : containers) {
                String id = container.path("Id").asText("").toLowerCase(Locale.ROOT);
                if (CONTAINER_ID.matcher(id).matches() && id.startsWith(workerId)) {
                    matches.add(id);
                }
            }
            if (matches.isEmpty()) {
                throw new IllegalArgumentException("Không tìm thấy container của máy chấm " + workerId);
            }
            if (matches.size() > 1) {
                throw new IllegalArgumentException("Mã máy chấm không xác định duy nhất");
            }
            return matches.getFirst();
        } catch (IOException e) {
            throw new IllegalStateException("Không thể đọc phản hồi từ Docker", e);
        }
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Tác vụ Docker đã bị gián đoạn", e);
        } catch (IOException e) {
            throw new IllegalStateException("Không thể kết nối dịch vụ điều khiển Docker", e);
        }
    }

    private static String validateWorkerId(String rawWorkerId) {
        String workerId = rawWorkerId == null ? "" : rawWorkerId.trim().toLowerCase(Locale.ROOT);
        if (!CONTAINER_ID.matcher(workerId).matches()) {
            throw new IllegalArgumentException("Mã máy chấm không đúng định dạng container");
        }
        return workerId;
    }

    public enum Action {
        START("khởi động"),
        STOP("dừng"),
        RESTART("khởi động lại");

        private final String label;

        Action(String label) {
            this.label = label;
        }

        public static Action parse(String value) {
            try {
                return valueOf(value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Hành động phải là START, STOP hoặc RESTART");
            }
        }
    }

    public record ActionResult(String workerId, Action action, String status) {}
}
