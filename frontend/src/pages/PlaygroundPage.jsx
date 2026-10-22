import { useState } from 'react'
import {
  App,
  Button,
  Input,
  Select,
  Space,
  Splitter,
  Tag,
  Typography,
} from 'antd'
import {
  CaretRightOutlined,
  CopyOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import CodeEditor from '../components/CodeEditor'
import VerdictTag from '../components/VerdictTag'
import { formatMemory, formatTime } from '../lib/format'

const PRESETS = [
  {
    key: 'hello',
    label: '1. Hello World (C++ Cơ bản)',
    input: '',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Xin chào, CodeJudge C++ Playground!" << endl;
    return 0;
}`,
  },
  {
    key: 'io',
    label: '2. Nhập xuất tính tổng A + B',
    input: '15 35',
    code: `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    if (cin >> a >> b) {
        long long sum = a + b;
        cout << "Tổng a + b = " << sum << endl;
    }
    return 0;
}`,
  },
  {
    key: 'prime',
    label: '3. Kiểm tra số nguyên tố',
    input: '97',
    code: `#include <iostream>
using namespace std;

bool isPrime(long long n) {
    if (n < 2) return false;
    for (long long i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    long long n;
    if (cin >> n) {
        if (isPrime(n)) {
            cout << n << " là số nguyên tố!" << endl;
        } else {
            cout << n << " KHÔNG phải số nguyên tố." << endl;
        }
    }
    return 0;
}`,
  },
  {
    key: 'fibo',
    label: '4. Dãy số Fibonacci (Vòng lặp)',
    input: '10',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        cout << "Dãy " << n << " số Fibonacci đầu tiên: ";
        long long f0 = 0, f1 = 1;
        for (int i = 0; i < n; i++) {
            cout << f0 << " ";
            long long fn = f0 + f1;
            f0 = f1;
            f1 = fn;
        }
        cout << endl;
    }
    return 0;
}`,
  },
  {
    key: 'sort',
    label: '5. Thư viện STL Vector & Sắp xếp',
    input: '6\n45 12 89 23 7 60',
    code: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        vector<int> a(n);
        for (int i = 0; i < n; i++) cin >> a[i];

        sort(a.begin(), a.end());

        cout << "Mảng sau khi sắp xếp tăng dần: ";
        for (int x : a) cout << x << " ";
        cout << endl;
    }
    return 0;
}`,
  },
]

export default function PlaygroundPage() {
  const location = useLocation()
  const { message } = App.useApp()

  const [selectedPreset, setSelectedPreset] = useState(
    location.state?.code ? undefined : 'hello'
  )
  const [code, setCode] = useState(
    location.state?.code || PRESETS[0].code
  )
  const [input, setInput] = useState(
    location.state?.input || PRESETS[0].input
  )
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  // Cập nhật code nếu điều hướng từ bài học sang
  const [prevLocationCode, setPrevLocationCode] = useState(location.state?.code)
  if (location.state?.code && location.state.code !== prevLocationCode) {
    setPrevLocationCode(location.state.code)
    setCode(location.state.code)
    if (location.state.input != null) setInput(location.state.input)
    setSelectedPreset(undefined)
    setResult(null)
  }

  const selectPreset = (presetKey) => {
    const found = PRESETS.find((p) => p.key === presetKey)
    if (found) {
      setSelectedPreset(presetKey)
      setCode(found.code)
      setInput(found.input)
      setResult(null)
      message.info(`Đã nạp mẫu: ${found.label}`)
    }
  }

  const handleRun = async () => {
    if (!code || code.trim().length === 0) {
      message.warning('Vui lòng nhập mã nguồn C++ trước khi chạy')
      return
    }

    setRunning(true)
    setResult(null)

    try {
      const res = await api.runTest({
        problemId: null,
        sourceCode: code,
        input: input || '',
        expectedOutput: '',
      })
      setResult(res)
    } catch (e) {
      setResult({
        verdict: 'RTE',
        output: '',
        stderr: e.message || 'Lỗi khi gửi yêu cầu thực thi tới máy chấm',
        timeMs: 0,
        memoryKb: 0,
      })
    } finally {
      setRunning(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    message.success('Đã sao chép mã nguồn!')
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top Toolbar */}
      <div
        style={{
          padding: '10px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Space>
            <PlayCircleOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              Trình chạy C++ Trực tuyến (Try it Yourself)
            </Typography.Title>
            <Tag color="blue">C++17 (g++)</Tag>
            {location.state?.lessonTitle && (
              <Tag color="purple">Bài học: {location.state.lessonTitle}</Tag>
            )}
          </Space>

          <Select
            placeholder="Chọn chương trình mẫu"
            style={{ width: 240 }}
            onChange={selectPreset}
            value={selectedPreset}
            options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>

        <Space>
          <Button icon={<CopyOutlined />} onClick={copyCode}>
            Sao chép
          </Button>
          <Button
            type="primary"
            icon={running ? <LoadingOutlined /> : <CaretRightOutlined />}
            loading={running}
            onClick={handleRun}
            size="large"
            style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600, paddingLeft: 24, paddingRight: 24 }}
          >
            {running ? 'Đang chạy…' : 'Chạy code (Run)'}
          </Button>
        </Space>
      </div>

      {/* Main Workspace (Splitter Left/Right) */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Splitter style={{ height: '100%' }}>
          {/* Cột trái: Code Editor */}
          <Splitter.Panel defaultSize="60%" min="35%">
            <div style={{ height: '100%', position: 'relative' }}>
              <CodeEditor value={code} onChange={setCode} onSubmit={handleRun} />
            </div>
          </Splitter.Panel>

          {/* Cột phải: Input & Console Output */}
          <Splitter.Panel defaultSize="40%" min="25%">
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                color: 'var(--text)',
                overflow: 'hidden',
              }}
            >
              {/* Input Section */}
              <div
                style={{
                  height: '35%',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '8px 16px',
                    background: 'var(--inset)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>DỮ LIỆU ĐẦU VÀO (STDIN)</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nhập các đối số cho cin</span>
                </div>
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập dữ liệu đầu vào cho chương trình..."
                  style={{
                    flex: 1,
                    resize: 'none',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: 'none',
                    borderRadius: 0,
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: 13,
                    padding: '12px 16px',
                  }}
                />
              </div>

              {/* Output Console Section */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 16px',
                    background: 'var(--inset)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>KẾT QUẢ ĐẦU RA (STDOUT)</span>
                    {result && <VerdictTag verdict={result.verdict} />}
                  </div>

                  {result && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 12 }}>
                      <span>Thời gian: <b>{formatTime(result.timeMs)}</b></span>
                      <span>RAM: <b>{formatMemory(result.memoryKb)}</b></span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: 16,
                    overflowY: 'auto',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {running ? (
                    <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8, padding: 20 }}>
                      <LoadingOutlined spin style={{ fontSize: 18 }} />
                      <span>Đang gửi mã nguồn tới máy chấm và thực thi…</span>
                    </div>
                  ) : !result ? (
                    <div style={{ color: 'var(--muted)', fontStyle: 'italic', padding: 20 }}>
                      Bấm nút "Chạy code (Run)" hoặc nhấn tổ hợp phím Ctrl + Enter để thực thi chương trình.
                    </div>
                  ) : result.compileLog ? (
                    <div>
                      <div style={{ color: 'var(--wa-fg)', fontWeight: 600, marginBottom: 8 }}>
                        ❌ LỖI BIÊN DỊCH (COMPILE ERROR):
                      </div>
                      <pre style={{ margin: 0, color: 'var(--wa-fg)', whiteSpace: 'pre-wrap' }}>
                        {result.compileLog}
                      </pre>
                    </div>
                  ) : (
                    <div>
                      {result.output ? (
                        <pre style={{ margin: 0, color: 'var(--ac-fg)', whiteSpace: 'pre-wrap' }}>
                          {result.output}
                        </pre>
                      ) : (
                        <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                          (Chương trình thực thi thành công nhưng không in ra dữ liệu gì)
                        </div>
                      )}

                      {result.stderr && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          <span style={{ color: 'var(--tle-fg)', fontSize: 12 }}>STDERR:</span>
                          <pre style={{ margin: 0, color: 'var(--tle-fg)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                            {result.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  )
}
