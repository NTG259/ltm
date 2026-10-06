package com.cplusplus.backend.master.ws;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetSocketAddress;

public class MasterWebSocketServer extends WebSocketServer {

    private static final Logger log = LoggerFactory.getLogger(MasterWebSocketServer.class);

    public MasterWebSocketServer(int port) {
        super(new InetSocketAddress(port));
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
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        log.debug("WebSocket client message: {}", message);
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
}
