# syntax=docker/dockerfile:1
# Judge Worker: Python (thư viện chuẩn) + g++ để biên dịch và chạy bài C++.

FROM python:3.14-slim
# g++ kéo theo libc6-dev và libstdc++-dev nên có sẵn libc.a / libstdc++.a để link tĩnh.
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10002 --create-home judge
WORKDIR /opt/judgement
COPY judgement judgement
USER judge
ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["python", "-m", "judgement"]
CMD ["worker", "--master-host", "backend", "--master-port", "9000"]
