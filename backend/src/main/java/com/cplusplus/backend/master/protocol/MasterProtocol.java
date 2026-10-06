package com.cplusplus.backend.master.protocol;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class MasterProtocol {

    public static final int MAGIC = 0xAA;
    public static final int HEADER_SIZE = 6;
    public static final int MAX_PAYLOAD = 10 * 1024 * 1024; // 10 MB

    public static final int OP_HEARTBEAT = 0x01;
    public static final int OP_WORKER_REGISTER = 0x02;
    public static final int OP_TASK_ASSIGN = 0x03;
    public static final int OP_TASK_STATUS = 0x04;
    public static final int OP_TASK_RESULT = 0x05;

    public record Message(int opcode, String jsonPayload) {}

    private MasterProtocol() {}

    public static Message readMessage(DataInputStream in) throws IOException {
        int magic = in.readUnsignedByte();
        if (magic != MAGIC) {
            throw new IOException(String.format("Sai magic byte: 0x%02X != 0x%02X", magic, MAGIC));
        }

        int opcode = in.readUnsignedByte();
        int length = in.readInt();
        if (length < 0 || length > MAX_PAYLOAD) {
            throw new IOException("Kích thước payload không hợp lệ: " + length);
        }

        byte[] payloadBytes = new byte[length];
        in.readFully(payloadBytes);
        String json = new String(payloadBytes, StandardCharsets.UTF_8);
        return new Message(opcode, json);
    }

    public static void writeMessage(DataOutputStream out, int opcode, String jsonPayload) throws IOException {
        byte[] payloadBytes = (jsonPayload == null ? "{}" : jsonPayload).getBytes(StandardCharsets.UTF_8);
        if (payloadBytes.length > MAX_PAYLOAD) {
            throw new IOException("Payload vượt quá giới hạn 10MB");
        }
        synchronized (out) {
            out.writeByte(MAGIC);
            out.writeByte(opcode);
            out.writeInt(payloadBytes.length);
            out.write(payloadBytes);
            out.flush();
        }
    }
}
