import { useRef, useState } from 'react'
import { App } from 'antd'
import { FileArchive, Save, Upload } from 'lucide-react'
import { api } from '../../../api'
import { DIFFICULTIES } from '../../../lib/verdicts'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select'
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../../ui/sheet'
import { Spinner } from '../../ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Textarea } from '../../ui/textarea'
import ProblemCasesEditor from './ProblemCasesEditor'

const DIFFICULTY_ITEMS = Object.entries(DIFFICULTIES).map(([value, item]) => ({
  value,
  label: item.label,
}))
const CHECKER_ITEMS = [
  { value: 'lines', label: 'Lines · so từng dòng' },
  { value: 'tokens', label: 'Tokens · bỏ khoảng trắng' },
  { value: 'exact', label: 'Exact · khớp từng ký tự' },
]

function normalizeProblem(problem) {
  return {
    title: problem?.title || '',
    difficulty: problem?.difficulty || 'easy',
    checker: problem?.checker || 'lines',
    tags: [...(problem?.tags || [])],
    timeLimitMs: problem?.timeLimitMs ?? 1000,
    memoryLimitMb: problem?.memoryLimitMb ?? 256,
    statement: problem?.statement || '',
    inputSpec: problem?.inputSpec || '',
    outputSpec: problem?.outputSpec || '',
    samples: (problem?.samples?.length ? problem.samples : [{ input: '', output: '' }])
      .map((item) => ({ ...item })),
    tests: (problem?.tests?.length ? problem.tests : [{ input: '', output: '' }])
      .map((item) => ({ ...item })),
  }
}

export default function ProblemEditorSheet({ open, problem, onClose, onSaved }) {
  const { message } = App.useApp()
  const zipInputRef = useRef(null)
  const [draft, setDraft] = useState(() => normalizeProblem(problem))
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState('info')
  const [saving, setSaving] = useState(false)
  const [uploadingZip, setUploadingZip] = useState(false)

  const update = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!draft.title.trim()) nextErrors.title = 'Vui lòng nhập tên bài.'
    if (!draft.statement.trim()) nextErrors.statement = 'Vui lòng nhập nội dung đề.'
    if (!draft.inputSpec.trim()) nextErrors.inputSpec = 'Vui lòng mô tả dữ liệu vào.'
    if (!draft.outputSpec.trim()) nextErrors.outputSpec = 'Vui lòng mô tả kết quả.'
    if (!draft.samples.length || draft.samples.some((item) => !item.input.trim() || !item.output.trim())) {
      nextErrors.samples = 'Mỗi ví dụ cần đủ input và output.'
    }
    if (!draft.tests.length || draft.tests.some((item) => !item.input.trim() || !item.output.trim())) {
      nextErrors.tests = 'Mỗi test cần đủ input và output.'
    }
    setErrors(nextErrors)
    if (nextErrors.title || nextErrors.statement || nextErrors.inputSpec || nextErrors.outputSpec) {
      setActiveTab('info')
    } else if (nextErrors.samples) {
      setActiveTab('samples')
    } else if (nextErrors.tests) {
      setActiveTab('tests')
    }
    return Object.keys(nextErrors).length === 0
  }

  const save = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const saved = await api.saveProblem({ ...draft, id: problem?.id })
      message.success(problem?.id ? `Đã cập nhật đề #${saved.id}` : `Đã thêm đề #${saved.id}`)
      onSaved()
    } catch (error) {
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const parseZip = async (event) => {
    const [file] = event.target.files || []
    event.target.value = ''
    if (!file) return
    setUploadingZip(true)
    try {
      const result = await api.parseProblemTestCasesZip(file)
      if (!result.tests?.length) {
        message.warning('Không tìm thấy testcase hợp lệ trong file ZIP')
        return
      }
      const hasContent = draft.tests.some((item) => item.input || item.output)
      update('tests', hasContent ? [...draft.tests, ...result.tests] : result.tests)
      message.success(`Đã nạp ${result.tests.length} testcase từ ${file.name}`)
      if (result.unpairedInputs?.length) {
        message.warning(`Có ${result.unpairedInputs.length} file input thiếu output tương ứng`)
      }
    } catch (error) {
      message.error(error.message || 'Không thể đọc file ZIP')
    } finally {
      setUploadingZip(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{problem?.id ? `Sửa đề #${problem.id}` : 'Thêm đề bài mới'}</SheetTitle>
            <SheetDescription>
              Soạn nội dung, ví dụ công khai và bộ test chấm trong cùng một luồng.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1">
            <div className="overflow-x-auto border-b px-4 py-2">
              <TabsList variant="line">
                <TabsTrigger value="info">Thông tin & đề bài</TabsTrigger>
                <TabsTrigger value="samples">Ví dụ ({draft.samples.length})</TabsTrigger>
                <TabsTrigger value="tests">Bộ test ({draft.tests.length})</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TabsContent value="info">
                <FieldGroup>
                  <Field data-invalid={!!errors.title}>
                    <FieldLabel htmlFor="problem-title">Tên bài</FieldLabel>
                    <Input
                      id="problem-title"
                      value={draft.title}
                      onChange={(event) => update('title', event.target.value)}
                      aria-invalid={!!errors.title}
                      autoFocus
                    />
                    <FieldError>{errors.title}</FieldError>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field>
                      <FieldLabel htmlFor="problem-difficulty">Độ khó</FieldLabel>
                      <Select items={DIFFICULTY_ITEMS} value={draft.difficulty} onValueChange={(value) => update('difficulty', value)}>
                        <SelectTrigger id="problem-difficulty" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {DIFFICULTY_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="problem-time-limit">Thời gian (ms)</FieldLabel>
                      <Input id="problem-time-limit" type="number" min={100} max={10000} step={100} value={draft.timeLimitMs} onChange={(event) => update('timeLimitMs', Number(event.target.value))} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="problem-memory-limit">Bộ nhớ (MB)</FieldLabel>
                      <Input id="problem-memory-limit" type="number" min={16} max={1024} step={16} value={draft.memoryLimitMb} onChange={(event) => update('memoryLimitMb', Number(event.target.value))} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="problem-checker">Checker</FieldLabel>
                      <Select items={CHECKER_ITEMS} value={draft.checker} onValueChange={(value) => update('checker', value)}>
                        <SelectTrigger id="problem-checker" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {CHECKER_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="problem-tags">Chủ đề</FieldLabel>
                    <Input
                      id="problem-tags"
                      value={draft.tags.join(', ')}
                      onChange={(event) => update('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))}
                      placeholder="mảng, quy hoạch động, đồ thị"
                    />
                    <FieldDescription>Phân tách các chủ đề bằng dấu phẩy.</FieldDescription>
                  </Field>

                  <Field data-invalid={!!errors.statement}>
                    <FieldLabel htmlFor="problem-statement">Nội dung đề</FieldLabel>
                    <Textarea id="problem-statement" className="min-h-44" value={draft.statement} onChange={(event) => update('statement', event.target.value)} aria-invalid={!!errors.statement} />
                    <FieldDescription>Dùng Markdown và backtick cho code inline.</FieldDescription>
                    <FieldError>{errors.statement}</FieldError>
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field data-invalid={!!errors.inputSpec}>
                      <FieldLabel htmlFor="problem-input-spec">Dữ liệu vào</FieldLabel>
                      <Textarea id="problem-input-spec" className="min-h-28" value={draft.inputSpec} onChange={(event) => update('inputSpec', event.target.value)} aria-invalid={!!errors.inputSpec} />
                      <FieldError>{errors.inputSpec}</FieldError>
                    </Field>
                    <Field data-invalid={!!errors.outputSpec}>
                      <FieldLabel htmlFor="problem-output-spec">Kết quả</FieldLabel>
                      <Textarea id="problem-output-spec" className="min-h-28" value={draft.outputSpec} onChange={(event) => update('outputSpec', event.target.value)} aria-invalid={!!errors.outputSpec} />
                      <FieldError>{errors.outputSpec}</FieldError>
                    </Field>
                  </div>
                </FieldGroup>
              </TabsContent>

              <TabsContent value="samples">
                {errors.samples && <FieldError className="mb-3">{errors.samples}</FieldError>}
                <ProblemCasesEditor
                  cases={draft.samples}
                  label="Ví dụ"
                  addLabel="Thêm ví dụ"
                  onChange={(value) => update('samples', value)}
                />
              </TabsContent>

              <TabsContent value="tests">
                <Card size="sm" className="mb-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileArchive />Nhập hàng loạt từ ZIP</CardTitle>
                    <CardDescription>
                      Hỗ trợ 1.in/1.out, test01.inp/test01.out hoặc thư mục input/output.
                    </CardDescription>
                    <CardAction>
                      <input ref={zipInputRef} type="file" accept=".zip" className="sr-only" onChange={parseZip} aria-label="Chọn file ZIP testcase" />
                      <Button type="button" variant="outline" disabled={uploadingZip} onClick={() => zipInputRef.current?.click()}>
                        {uploadingZip ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                        Chọn ZIP
                      </Button>
                    </CardAction>
                  </CardHeader>
                </Card>
                <Alert className="mb-4">
                  <AlertTitle>Bộ test được giữ kín</AlertTitle>
                  <AlertDescription>Worker chạy lần lượt từng test qua stdin/stdout theo checker đã chọn.</AlertDescription>
                </Alert>
                {errors.tests && <FieldError className="mb-3">{errors.tests}</FieldError>}
                <ProblemCasesEditor
                  cases={draft.tests}
                  label="Test"
                  addLabel="Thêm test case"
                  onChange={(value) => update('tests', value)}
                />
              </TabsContent>
            </div>
          </Tabs>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              Lưu đề bài
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
