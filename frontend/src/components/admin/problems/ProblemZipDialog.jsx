import { useState } from 'react'
import { App } from 'antd'
import { FileArchive, Upload } from 'lucide-react'
import { api } from '../../../api'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog'
import { Field, FieldContent, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Spinner } from '../../ui/spinner'

export default function ProblemZipDialog({ open, problem, onClose, onUploaded }) {
  const { message } = App.useApp()
  const [file, setFile] = useState(null)
  const [keepSamples, setKeepSamples] = useState(true)
  const [uploading, setUploading] = useState(false)

  const close = () => {
    if (uploading) return
    setFile(null)
    onClose()
  }

  const upload = async (event) => {
    event.preventDefault()
    if (!file) {
      message.warning('Vui lòng chọn file .zip')
      return
    }
    setUploading(true)
    try {
      const result = await api.uploadProblemTestCasesZip(problem.id, file, keepSamples)
      message.success(result.message || `Đã nhập ${result.importedCount} test case`)
      if (result.unpairedInputs?.length) {
        message.warning(`Có ${result.unpairedInputs.length} file input thiếu output tương ứng`)
      }
      onUploaded()
      setFile(null)
      onClose()
    } catch (error) {
      message.error(error.message || 'Không thể tải lên file ZIP')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={upload}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive />
              Nhập bộ test · #{problem?.id}
            </DialogTitle>
            <DialogDescription>{problem?.title}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Alert>
              <AlertTitle>Định dạng ZIP được hỗ trợ</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 flex list-disc flex-col gap-1">
                  <li>1.in / 1.out hoặc test03.in / test03.ans</li>
                  <li>input/1.txt và output/1.txt</li>
                  <li>test01/input.txt và test01/output.txt</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Field orientation="horizontal">
              <Checkbox id="keep-problem-samples" checked={keepSamples} onCheckedChange={setKeepSamples} />
              <FieldContent>
                <FieldLabel htmlFor="keep-problem-samples">Giữ các test ví dụ hiện có</FieldLabel>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="problem-zip-file">File testcase (.zip)</FieldLabel>
              <Input
                id="problem-zip-file"
                type="file"
                accept=".zip"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Đóng</Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
              Bắt đầu nhập test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
