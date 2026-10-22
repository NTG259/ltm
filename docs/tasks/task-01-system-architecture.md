# Task 01 — System Architecture

**Dependency:** Không có — làm đầu tiên, mọi cụm khác phụ thuộc vào cụm này.

## Objective

Vẽ bản đồ toàn hệ thống: xác định rõ tất cả nodes, vai trò, cổng kết nối, và luồng dữ liệu của một bài nộp từ Submit đến Verdict.

## Research areas

- Vai trò của Nginx trong kiến trúc phân tán (reverse proxy, load balancing, TLS termination)
- Tại sao cần tách Master HTTP (`:8000`) khỏi Master WebSocket (`:8001`) và Worker TCP (`:9000`)
- Cách Worker cluster scale ngang (thêm worker không cần thay đổi Master)
- Trade-off giữa Redis Streams vs in-memory queue về durability và latency

## Design deliverables

1. **Sơ đồ kiến trúc tổng thể** với 5 nodes:
   - Client (Browser SPA)
   - Nginx (gateway + reverse proxy)
   - Master (Spring Boot)
   - Redis (queue + pub/sub)
   - Worker cluster (Python × N)

2. **Data flow diagram** — vòng đời một bài nộp:
   ```
   Client → Nginx → Master → Redis → Worker → Master → DB → Master → WebSocket → Client
   ```
   Ghi rõ: giao thức, port, định dạng message tại mỗi bước.

3. **Port map** — tất cả cổng và giao thức:
   | Port | Giao thức | Từ | Đến | Mô tả |
   |------|-----------|-----|-----|-------|
   | 80/443 | HTTP/HTTPS | Client | Nginx | Public |
   | 8000 | HTTP | Nginx | Master | REST API |
   | 8001 | WebSocket | Nginx | Master | Real-time |
   | 9000 | TCP binary | Master | Worker | Judge protocol |
   | 6379 | Redis | Master | Redis | Queue |

4. **Component responsibilities** — mỗi component làm gì, KHÔNG làm gì

5. **Scale-out design** — thêm Worker node mới cần làm gì (chỉ connect TCP đến Master là đủ?)

## Quality checklist

- [ ] Sơ đồ có đủ 5 nodes, có label port và giao thức tại mỗi mũi tên
- [ ] Data flow bao gồm cả happy path và error path (worker mất kết nối)
- [ ] Mỗi component liệt kê rõ trách nhiệm và giới hạn trách nhiệm
- [ ] Ghi rõ component nào stateless / stateful
- [ ] Scale-out: thêm Worker không yêu cầu config lại Master hay Nginx
- [ ] Ghi rõ component nào có trong codebase hiện tại và component nào cần thêm mới (Nginx, Redis)
- [ ] Sơ đồ đủ để đưa thẳng vào mục "System Architecture" của báo cáo (có thể vẽ lại bằng draw.io)
- [ ] Một người chưa đọc code có thể hiểu toàn bộ hệ thống chỉ từ tài liệu này

## Mapping báo cáo

- §8.3 System Architecture
- §8.7 Proposed Approach → Architecture
- §8.8 System Architecture (full section)
