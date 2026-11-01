package com.cplusplus.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WorkerContainerServiceTest {

    private HttpServer server;
    private final List<String> requests = new ArrayList<>();
    private WorkerContainerService service;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", this::handle);
        server.start();
        service = new WorkerContainerService(
                new ObjectMapper(),
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "codejudge"
        );
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void rejectsWorkerIdThatCannotBeAContainerId() {
        assertThrows(IllegalArgumentException.class,
                () -> service.apply("../../backend", WorkerContainerService.Action.STOP));
        assertEquals(List.of(), requests);
    }

    @Test
    void stopsOnlyAWorkerContainerFromTheConfiguredComposeProject() {
        WorkerContainerService.ActionResult result = service.apply(
                "a1b2c3d4e5f6",
                WorkerContainerService.Action.STOP
        );

        assertEquals("a1b2c3d4e5f6", result.workerId());
        assertEquals(WorkerContainerService.Action.STOP, result.action());
        assertEquals("ACCEPTED", result.status());
        assertEquals(2, requests.size());
        assertEquals("POST /v1.44/containers/a1b2c3d4e5f678901234567890123456789012345678901234567890123456/stop?t=10", requests.get(1));
    }

    @Test
    void refusesContainerThatIsNotInTheAllowlistedWorkerSet() {
        assertThrows(IllegalArgumentException.class,
                () -> service.apply("ffffffffffff", WorkerContainerService.Action.START));
        assertEquals(1, requests.size());
    }

    private void handle(HttpExchange exchange) throws IOException {
        requests.add(exchange.getRequestMethod() + " " + exchange.getRequestURI());
        if (exchange.getRequestURI().getPath().endsWith("/containers/json")) {
            byte[] body = ("["
                    + "{\"Id\":\"a1b2c3d4e5f678901234567890123456789012345678901234567890123456\"},"
                    + "{\"Id\":\"bbbbbbbbbbbb78901234567890123456789012345678901234567890123456\"}"
                    + "]").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
        } else {
            exchange.sendResponseHeaders(204, -1);
        }
        exchange.close();
    }
}
