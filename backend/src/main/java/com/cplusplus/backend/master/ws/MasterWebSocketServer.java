package com.cplusplus.backend.master.ws;

import com.cplusplus.backend.domain.user.Role;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.security.SecurityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class MasterWebSocketServer extends WebSocketServer {

    private static final Logger log = LoggerFactory.getLogger(MasterWebSocketServer.class);

    private final SecurityService securityService;
    private final ObjectMapper objectMapper;

    // conn → userId (chỉ conn đã AUTH thành công)
    private final Map<WebSocket, Long> connUserIds = new ConcurrentHashMap<>();
    // conn → username (để broadcast OFFLINE sau khi conn đóng)
    private final Map<WebSocket, String> connUsernames = new ConcurrentHashMap<>();
    // conn → role (STUDENT, LECTURER, ADMIN)
    private final Map<WebSocket, Role> connRoles = new ConcurrentHashMap<>();
    // conn → isStaff (Admin or Lecturer)
    private final Map<WebSocket, Boolean> connAdmins = new ConcurrentHashMap<>();

    public MasterWebSocketServer(int port, SecurityService securityService, ObjectMapper objectMapper) {
        super(new InetSocketAddress(port));
        this.securityService = securityService;
        this.objectMapper = objectMapper;
        setReuseAddr(true);
        setTcpNoDelay(true);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        log.info("WebSocket client connected: {}", conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        log.info("WebSocket client disconnected: {}, code: {}, reason: {}",
                conn != null ? conn.getRemoteSocketAddress() : "unknown", code, reason);
        if (conn != null) {
            Long userId = connUserIds.remove(conn);
            String username = connUsernames.remove(conn);
            Role role = connRoles.remove(conn);
            connAdmins.remove(conn);
            if (userId != null && role == Role.STUDENT) {
                broadcastPresenceEvent("OFFLINE", userId, username);
            }
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        log.debug("WebSocket client message: {}", message);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> msg = objectMapper.readValue(message, Map.class);
            if ("AUTH".equals(msg.get("type"))) {
                String token = (String) msg.get("token");
                if (token != null) {
                    securityService.authenticate(token).ifPresent(user -> handleAuth(conn, user));
                }
            }
        } catch (Exception e) {
            log.debug("Không parse được WebSocket message: {}", e.getMessage());
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        log.warn("WebSocket error on {}: {}",
                conn != null ? conn.getRemoteSocketAddress() : "server", ex.getMessage());
    }

    @Override
    public void onStart() {
        log.info("WebSocket server RFC 6455 started on port {}", getPort());
    }

    public void broadcastText(String text) {
        broadcast(text);
    }

    public void broadcastToAdmins(String text) {
        for (WebSocket conn : getConnections()) {
            if (Boolean.TRUE.equals(connAdmins.get(conn)) && conn.isOpen()) {
                try {
                    conn.send(text);
                } catch (Exception e) {
                    log.debug("Lỗi gửi tới admin conn: {}", e.getMessage());
                }
            }
        }
    }

    /** Trả về userId của tất cả student đang kết nối (không bao gồm admin). */
    public Set<Long> getOnlineUserIds() {
        return connUserIds.entrySet().stream()
                .filter(e -> connRoles.get(e.getKey()) == Role.STUDENT)
                .map(Map.Entry::getValue)
                .collect(Collectors.toSet());
    }

    private void handleAuth(WebSocket conn, User user) {
        boolean isStaff = user.getRole() == Role.ADMIN || user.getRole() == Role.LECTURER;
        connUserIds.put(conn, user.getId());
        connUsernames.put(conn, user.getUsername());
        connRoles.put(conn, user.getRole());
        connAdmins.put(conn, isStaff);
        if (user.getRole() == Role.STUDENT) {
            broadcastPresenceEvent("ONLINE", user.getId(), user.getUsername());
        }
        log.debug("WebSocket AUTH OK: {} (role={})", user.getUsername(), user.getRole());
    }

    private void broadcastPresenceEvent(String status, Long userId, String username) {
        try {
            Map<String, Object> event = Map.of(
                    "type", "PRESENCE_UPDATE",
                    "status", status,
                    "userId", userId,
                    "username", username != null ? username : ""
            );
            broadcastToAdmins(objectMapper.writeValueAsString(event));
        } catch (Exception e) {
            log.warn("Lỗi broadcast PRESENCE_UPDATE: {}", e.getMessage());
        }
    }
}
