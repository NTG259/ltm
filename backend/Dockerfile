# syntax=docker/dockerfile:1
# Master Server (Spring Boot): HTTP :8000, WebSocket :8001, TCP Worker :9000.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
COPY src src
# Test cần Docker (Testcontainers) nên chạy ngoài image: ./mvnw test
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q -DskipTests package \
 && cp target/backend-*.jar /app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 master
COPY --from=build /app.jar /opt/backend/app.jar
USER master
EXPOSE 8000 8001 9000
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/opt/backend/app.jar"]
