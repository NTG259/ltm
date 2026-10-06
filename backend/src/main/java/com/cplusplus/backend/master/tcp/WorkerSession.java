package com.cplusplus.backend.master.tcp;

import com.cplusplus.backend.master.protocol.MasterProtocol;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Socket;

public class WorkerSession {

    private static final Logger log = LoggerFactory.getLogger(WorkerSession.class);

    private final Socket socket;
    private final DataInputStream in;
    private final DataOutputStream out;

    private String id;
    private String address;
    private String hostname;
    private String version;
    private String compiler;
    private String sandbox;

    private volatile boolean busy = false;
    private volatile Long currentTask = null;
    private volatile int completed = 0;
    private volatile long connectedAt = System.currentTimeMillis();
    private volatile long lastHeartbeat = System.currentTimeMillis();
    private volatile long latencyMs = 0;
    private volatile boolean closed = false;

    public WorkerSession(Socket socket) throws IOException {
        this.socket = socket;
        this.in = new DataInputStream(socket.getInputStream());
        this.out = new DataOutputStream(socket.getOutputStream());
        this.address = socket.getInetAddress().getHostAddress() + ":" + socket.getPort();
    }

    public synchronized void send(int opcode, String jsonPayload) throws IOException {
        if (closed) {
            throw new IOException("Socket đã đóng đối với worker: " + id);
        }
        MasterProtocol.writeMessage(out, opcode, jsonPayload);
    }

    public MasterProtocol.Message readMessage() throws IOException {
        return MasterProtocol.readMessage(in);
    }

    public void close() {
        closed = true;
        try {
            socket.close();
        } catch (IOException ignored) {
        }
    }

    public boolean isClosed() {
        return closed || socket.isClosed();
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getCompiler() { return compiler; }
    public void setCompiler(String compiler) { this.compiler = compiler; }

    public String getSandbox() { return sandbox; }
    public void setSandbox(String sandbox) { this.sandbox = sandbox; }

    public boolean isBusy() { return busy; }
    public void setBusy(boolean busy) { this.busy = busy; }

    public Long getCurrentTask() { return currentTask; }
    public void setCurrentTask(Long currentTask) { this.currentTask = currentTask; }

    public int getCompleted() { return completed; }
    public void setCompleted(int completed) { this.completed = completed; }

    public long getConnectedAt() { return connectedAt; }
    public void setConnectedAt(long connectedAt) { this.connectedAt = connectedAt; }

    public long getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(long lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }

    public long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(long latencyMs) { this.latencyMs = latencyMs; }
}
